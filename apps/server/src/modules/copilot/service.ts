import {
  applyPatch,
  CopilotEnvelopeSchema,
  CopilotIntentSchema,
  TripStateSchema,
  type CopilotIntent,
  type TripPatch,
  type TripState,
} from "@visepanda/domain";
import { z } from "zod";
import type { TripOwner, TripService } from "../trip/service.js";

export const CopilotRunInputSchema = z.object({
  message: z.string().min(1),
  tripId: z.string().min(1).optional(),
  anonId: z.string().min(1).optional(),
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  currentTrip: TripStateSchema.nullable().optional(),
});

export const RetrievalFactSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  summary: z.string().min(1),
});

export const CopilotRunResultSchema = z.object({
  envelope: CopilotEnvelopeSchema,
  trip: TripStateSchema.nullable(),
  trace: z.object({
    intent: CopilotIntentSchema,
    retrievedFactIds: z.array(z.string().min(1)),
    appliedPatchCount: z.number().int().nonnegative(),
  }),
});

export type CopilotRunInput = z.infer<typeof CopilotRunInputSchema>;
export type RetrievalFact = z.infer<typeof RetrievalFactSchema>;
export type CopilotRunResult = z.infer<typeof CopilotRunResultSchema>;

type RouteIntent = (request: CopilotRequest) => Promise<CopilotIntent> | CopilotIntent;
type RetrieveContext = (request: CopilotRequest) => Promise<RetrievalFact[]> | RetrievalFact[];
type GenerateEnvelope = (request: CopilotGenerationRequest) => Promise<unknown> | unknown;

type CopilotRequest = {
  message: string;
  tripId?: string;
  owner?: TripOwner;
  currentTrip: TripState | null;
};

type CopilotGenerationRequest = CopilotRequest & {
  intent: CopilotIntent;
  retrievedFacts: RetrievalFact[];
};

export type CopilotPipelineDependencies = {
  tripService: TripService;
  routeIntent?: RouteIntent;
  retrieveContext?: RetrieveContext;
  generateEnvelope?: GenerateEnvelope;
};

export function createCopilotPipeline({
  tripService,
  routeIntent = defaultRouteIntent,
  retrieveContext = defaultRetrieveContext,
  generateEnvelope = defaultGenerateEnvelope,
}: CopilotPipelineDependencies) {
  return {
    async run(input: CopilotRunInput): Promise<CopilotRunResult> {
      const parsedInput = CopilotRunInputSchema.parse(input);
      const owner = toTripOwner(parsedInput);
      const currentTrip =
        parsedInput.currentTrip ??
        (parsedInput.tripId ? await tripService.get(parsedInput.tripId, owner) : null);
      const request: CopilotRequest = {
        message: parsedInput.message,
        currentTrip,
      };
      if (parsedInput.tripId) request.tripId = parsedInput.tripId;
      if (owner) request.owner = owner;
      const intent = await routeIntent(request);
      const retrievedFacts = await retrieveContext(request);
      const envelope = CopilotEnvelopeSchema.parse(
        await generateEnvelope({ ...request, intent, retrievedFacts }),
      );
      let trip = currentTrip;
      const appliedOperations: TripPatch["operations"] = [];

      for (const patch of envelope.tripActions) {
        trip = applyPatch(trip, patch);
        appliedOperations.push(...patch.operations);
      }

      if (trip) {
        await tripService.save(trip, {
          owner,
          patch: { operations: appliedOperations },
          source: "ai_copilot",
        });
      }

      return CopilotRunResultSchema.parse({
        envelope,
        trip,
        trace: {
          intent,
          retrievedFactIds: retrievedFacts.map((fact) => fact.id),
          appliedPatchCount: envelope.tripActions.length,
        },
      });
    },
  };
}

export function defaultRouteIntent({ message }: CopilotRequest): CopilotIntent {
  const normalized = message.toLowerCase();

  if (/\b(human|person|agent|concierge|emergency|help me call)\b/.test(normalized)) {
    return "human_help";
  }
  if (/\b(plan|itinerary|trip|schedule)\b/.test(normalized)) {
    return "trip_create";
  }
  if (/\b(add|change|update|move|remove|delete)\b/.test(normalized)) {
    return "trip_edit";
  }
  if (/\b(book|buy|ticket|reserve|price|hotel|payment)\b/.test(normalized)) {
    return "commerce_intent";
  }
  if (normalized.includes("?") || /^(what|where|when|why|how)\b/.test(normalized)) {
    return "question";
  }

  return "chat_only";
}

export function defaultRetrieveContext(): RetrievalFact[] {
  return [
    {
      id: "stub:china-execution-basics",
      label: "China execution basics",
      summary: "Knowledge retrieval is stubbed until the knowledge module lands.",
    },
  ];
}

export function defaultGenerateEnvelope({
  currentTrip,
  intent,
  message,
  tripId,
}: CopilotGenerationRequest): unknown {
  if (intent === "trip_create" && !currentTrip) {
    const city = inferCity(message);
    const totalDays = inferTripDays(message);
    return {
      intent,
      message: {
        headline: `${city} skeleton ready`,
        body: "I created the trip shell first. A second pass can now fill the day details.",
        highlights: ["Skeleton first", "Details pending"],
      },
      tripActions: [
        {
          operations: [
            {
              op: "create_trip",
              trip: {
                id: tripId ?? crypto.randomUUID(),
                title: `${city} first-timer`,
                destinationCountry: "CN",
                days: Array.from({ length: totalDays }, (_, index) => ({
                  id: `day-${index + 1}`,
                  dayNumber: index + 1,
                  city,
                  title: index === 0 ? "Arrival" : `Day ${index + 1}`,
                  blocks: [],
                })),
              },
            },
          ],
        },
      ],
      toolCards: [
        {
          id: "tool-payment-basics",
          kind: "payment",
          title: "Payment prep",
          body: "Set up Alipay or WeChat Pay before landing, and keep one backup card.",
        },
        {
          id: "tool-metro-route",
          kind: "transport",
          title: "Metro-friendly route",
          body: "I will favor days that are easy to execute by metro before suggesting taxis.",
        },
      ],
      citations: [{ fact_id: "stub:china-execution-basics", label: "Stub retrieval" }],
    };
  }

  return {
    intent,
    message: {
      headline: "I can help",
      body: currentTrip
        ? "I reviewed the current trip context and kept the itinerary unchanged."
        : "I can answer now, or create a trip shell when you ask me to plan one.",
      highlights: [],
    },
    citations: [{ fact_id: "stub:china-execution-basics", label: "Stub retrieval" }],
  };
}

function toTripOwner(input: z.infer<typeof CopilotRunInputSchema>): TripOwner | undefined {
  if (!input.userId && !input.anonId) return undefined;
  return {
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.anonId ? { anonId: input.anonId } : {}),
    ...(input.email ? { email: input.email } : {}),
  };
}

function inferCity(message: string): string {
  if (/\bbeijing\b/i.test(message)) return "Beijing";
  if (/\bchengdu\b/i.test(message)) return "Chengdu";
  if (/\bshanghai\b/i.test(message)) return "Shanghai";
  return "Shanghai";
}

function inferTripDays(message: string): number {
  const match = message.match(/\b([1-9]|1[0-4])\s*(?:day|days)\b/i);
  if (!match?.[1]) return 2;
  return Number(match[1]);
}
