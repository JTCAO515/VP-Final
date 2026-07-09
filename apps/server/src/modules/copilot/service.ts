import {
  applyPatch,
  CopilotEnvelopeSchema,
  CopilotIntentSchema,
  TripStateSchema,
  type CopilotIntent,
  type TripState,
} from "@visepanda/domain";
import { z } from "zod";
import type { TripService } from "../trip/service.js";

export const CopilotRunInputSchema = z.object({
  message: z.string().min(1),
  tripId: z.string().min(1).optional(),
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
      const currentTrip =
        parsedInput.currentTrip ??
        (parsedInput.tripId ? await tripService.get(parsedInput.tripId) : null);
      const request: CopilotRequest = {
        message: parsedInput.message,
        currentTrip,
      };
      if (parsedInput.tripId) request.tripId = parsedInput.tripId;
      const intent = await routeIntent(request);
      const retrievedFacts = await retrieveContext(request);
      const envelope = CopilotEnvelopeSchema.parse(
        await generateEnvelope({ ...request, intent, retrievedFacts }),
      );
      let trip = currentTrip;

      for (const patch of envelope.tripActions) {
        trip = applyPatch(trip, patch);
      }

      if (trip) {
        await tripService.save(trip);
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
  if (/\b(book|buy|ticket|reserve|price|hotel|payment)\b/.test(normalized)) {
    return "commerce_intent";
  }
  if (/\b(plan|itinerary|trip|schedule)\b/.test(normalized)) {
    return "trip_create";
  }
  if (/\b(add|change|update|move|remove|delete)\b/.test(normalized)) {
    return "trip_edit";
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
  tripId,
}: CopilotGenerationRequest): unknown {
  if (intent === "trip_create" && !currentTrip) {
    return {
      intent,
      message: {
        headline: "Draft trip ready",
        body: "I created a safe starter itinerary shell. Later passes will add real details.",
        highlights: [],
      },
      tripActions: [
        {
          operations: [
            {
              op: "create_trip",
              trip: {
                id: tripId ?? "trip-draft",
                title: "China trip draft",
                destinationCountry: "CN",
                days: [],
              },
            },
          ],
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
