import {
  applyPatch,
  CopilotEnvelopeSchema,
  CopilotIntentSchema,
  TripStateSchema,
  type CopilotEnvelope,
  type CopilotIntent,
  type TripPatch,
  type TripState,
} from "@visepanda/domain";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { KnowledgeService } from "../knowledge/service.js";
import type { AgentTraceService } from "../trace/service.js";
import { normalizeAgentFailure } from "../trace/service.js";
import type { TripIdentity, VersionedTripService } from "../trip/versionedService.js";

export const CopilotRunInputSchema = z.object({
  message: z.string().min(1),
  tripId: z.string().min(1).optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
});

export const RetrievalFactSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  summary: z.string().min(1),
});

export const CopilotRunResultSchema = z.object({
  envelope: CopilotEnvelopeSchema,
  trip: TripStateSchema.nullable(),
  version: z.number().int().nonnegative().nullable(),
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
  tripService: VersionedTripService;
  knowledgeService?: KnowledgeService;
  routeIntent?: RouteIntent;
  retrieveContext?: RetrieveContext;
  generateEnvelope?: GenerateEnvelope;
  traceService?: AgentTraceService;
};

export function createCopilotPipeline({
  knowledgeService,
  tripService,
  routeIntent = defaultRouteIntent,
  retrieveContext = defaultRetrieveContext,
  generateEnvelope = defaultGenerateEnvelope,
  traceService,
}: CopilotPipelineDependencies) {
  return {
    async run(input: CopilotRunInput, identity: TripIdentity): Promise<CopilotRunResult> {
      const startedAt = Date.now();
      const runId = crypto.randomUUID();
      const parsedInput = CopilotRunInputSchema.parse(input);
      let intent: CopilotIntent | undefined;
      try {
        const currentSnapshot = parsedInput.tripId
          ? await tripService.get(parsedInput.tripId, identity)
          : null;
        if (parsedInput.tripId && !currentSnapshot) throw new Error("Trip not found.");
        const currentTrip = currentSnapshot?.trip ?? null;
        const request: CopilotRequest = {
          message: parsedInput.message,
          currentTrip,
        };
        if (parsedInput.tripId) request.tripId = parsedInput.tripId;
        intent = await routeIntent(request);
        const retrievedFacts = await retrieveContext(request);
        const envelope = CopilotEnvelopeSchema.parse(
          await generateEnvelope({ ...request, intent, retrievedFacts }),
        );
        if (knowledgeService && shouldRecordKnowledgeGap(envelope)) {
          const city = detectCity(parsedInput.message);
          await knowledgeService.recordGap({
            question: parsedInput.message,
            ...(city ? { city } : {}),
          });
        }
        let trip = currentTrip;
        let version = currentSnapshot?.version ?? null;
        const appliedOperations: TripPatch["operations"] = [];

        for (const patch of envelope.tripActions) {
          trip = applyPatch(trip, patch);
          appliedOperations.push(...patch.operations);
        }

        if (trip && !currentSnapshot) {
          const created = await tripService.create(trip, identity, "ai_copilot");
          trip = created.trip;
          version = created.version;
        } else if (currentSnapshot && appliedOperations.length > 0) {
          if (parsedInput.expectedVersion === undefined) {
            throw new Error("expectedVersion is required when updating an existing Trip.");
          }
          const updated = await tripService.apply({
            id: currentSnapshot.trip.id,
            identity,
            expectedVersion: parsedInput.expectedVersion,
            patch: { operations: appliedOperations },
            source: "ai_copilot",
          });
          if (!updated) throw new Error("Trip not found.");
          trip = updated.trip;
          version = updated.version;
        }

        const result = CopilotRunResultSchema.parse({
          envelope,
          trip,
          version,
          trace: {
            intent,
            retrievedFactIds: retrievedFacts.map((fact) => fact.id),
            appliedPatchCount: envelope.tripActions.length,
          },
        });
        await recordTraceSafely(traceService, {
          id: runId,
          identity,
          ...(result.trip?.id ? { tripId: result.trip.id } : {}),
          intent,
          status: "succeeded",
          inputDigest: digest(parsedInput.message),
          outputDigest: digest(JSON.stringify(result.envelope)),
          latencyMs: Date.now() - startedAt,
          attempts: [],
          validationStatus: "passed",
          repairCount: 0,
        });
        return result;
      } catch (error) {
        await recordTraceSafely(traceService, {
          id: runId,
          identity,
          ...(parsedInput.tripId ? { tripId: parsedInput.tripId } : {}),
          ...(intent ? { intent } : {}),
          status: "failed",
          inputDigest: digest(parsedInput.message),
          latencyMs: Date.now() - startedAt,
          attempts: [],
          validationStatus: "failed",
          repairCount: 0,
          failureClass: normalizeAgentFailure(error),
        });
        throw error;
      }
    },
  };
}

async function recordTraceSafely(
  traceService: AgentTraceService | undefined,
  input: Parameters<AgentTraceService["recordRun"]>[0],
): Promise<void> {
  if (!traceService) return;
  try {
    await traceService.recordRun(input);
  } catch {
    // Observability must never change the user-visible Copilot result.
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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

  if (intent === "commerce_intent") {
    return {
      intent,
      message: {
        headline: "Booking options ready",
        body: "I found a partner booking route. Please review the partner page before paying.",
        highlights: ["Partner link", "Review before purchase"],
      },
      commercialActions: [
        {
          id: "commercial-tripcom-hotels",
          kind: "outbound_link",
          label: "Open Trip.com hotels",
          partner: "tripcom",
          disclosure: "Partner link; VisePanda may earn a commission.",
          click_id: crypto.randomUUID(),
          url: "https://www.trip.com/hotels/",
        },
      ],
      citations: [{ fact_id: "guide:payment", label: "Payment guide", source: "VisePanda" }],
    };
  }

  if (intent === "human_help") {
    return {
      intent,
      message: {
        headline: "Human help draft ready",
        body: "I prepared a manual-help request. Please review it before sending.",
        highlights: ["Human review required"],
      },
      humanHelp: {
        kind: "task",
        city: inferCity(message),
        prefill: message,
      },
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
    citations: [
      { fact_id: "stub:china-execution-basics", label: "Stub retrieval", source: "VisePanda" },
    ],
  };
}

function inferCity(message: string): string {
  if (/\bbeijing\b/i.test(message)) return "Beijing";
  if (/\bchengdu\b/i.test(message)) return "Chengdu";
  if (/\bshanghai\b/i.test(message)) return "Shanghai";
  return "Shanghai";
}

function detectCity(message: string): string | undefined {
  if (/\bbeijing\b/i.test(message)) return "Beijing";
  if (/\bchengdu\b/i.test(message)) return "Chengdu";
  if (/\bshanghai\b/i.test(message)) return "Shanghai";
  return undefined;
}

function inferTripDays(message: string): number {
  const match = message.match(/\b([1-9]|1[0-4])\s*(?:day|days)\b/i);
  if (!match?.[1]) return 2;
  return Number(match[1]);
}

function shouldRecordKnowledgeGap(envelope: CopilotEnvelope): boolean {
  if (envelope.intent !== "question" && envelope.intent !== "chat_only") return false;
  const body = envelope.message.body.toLowerCase();
  return (
    envelope.citations.length === 0 ||
    body.includes("unknown") ||
    body.includes("don't know") ||
    body.includes("do not know") ||
    body.includes("could not answer")
  );
}
