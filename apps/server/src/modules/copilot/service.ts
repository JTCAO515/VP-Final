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
import type { AgentAttemptTrace, AgentTraceService } from "../trace/service.js";
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
  source: z.string().min(1),
  verifiedAt: z.string().datetime(),
  confidence: z.number().min(0).max(1),
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

export type CopilotIntentDecision = {
  intent: CopilotIntent;
  attempts?: AgentAttemptTrace[];
};

type RouteIntent =
  | ((request: CopilotRequest) => Promise<CopilotIntent | CopilotIntentDecision>)
  | ((request: CopilotRequest) => CopilotIntent | CopilotIntentDecision);
type RetrieveContext = (request: CopilotRequest) => Promise<RetrievalFact[]> | RetrievalFact[];
export type GeneratedEnvelope = {
  candidate: unknown;
  attempts?: AgentAttemptTrace[];
};

type GenerateEnvelope =
  | ((request: CopilotGenerationRequest) => Promise<unknown | GeneratedEnvelope>)
  | ((request: CopilotGenerationRequest) => unknown | GeneratedEnvelope);

export type CopilotRequest = {
  message: string;
  tripId?: string;
  currentTrip: TripState | null;
};

export type CopilotGenerationRequest = CopilotRequest & {
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
  demoDialogueOnly?: boolean;
};

export function createCopilotPipeline({
  knowledgeService,
  tripService,
  routeIntent = defaultRouteIntent,
  retrieveContext = defaultRetrieveContext,
  generateEnvelope = defaultGenerateEnvelope,
  traceService,
  demoDialogueOnly = false,
}: CopilotPipelineDependencies) {
  return {
    async run(input: CopilotRunInput, identity: TripIdentity): Promise<CopilotRunResult> {
      const startedAt = Date.now();
      const runId = crypto.randomUUID();
      const parsedInput = CopilotRunInputSchema.parse(input);
      let intent: CopilotIntent | undefined;
      let attempts: AgentAttemptTrace[] = [];
      let repairCount = 0;
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
        const decision = normalizeIntentDecision(await routeIntent(request));
        intent = decision.intent;
        attempts = decision.attempts ?? [];
        const retrievedFacts = await (knowledgeService
          ? retrieveEligibleFacts(knowledgeService, request, intent)
          : retrieveContext(request));
        const parsedGeneration = parseGeneratedEnvelope(
          await generateEnvelope({ ...request, intent, retrievedFacts }),
        );
        attempts = [...attempts, ...parsedGeneration.attempts];
        repairCount = parsedGeneration.repairCount;
        if (demoDialogueOnly && parsedGeneration.envelope.intent !== intent) {
          throw new Error("Copilot envelope intent does not match the router decision.");
        }
        if (demoDialogueOnly) assertDemoDialogueEnvelope(parsedGeneration.envelope);
        const envelope = validateCitations(parsedGeneration.envelope, retrievedFacts);
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
          attempts,
          validationStatus: "passed",
          repairCount,
        });
        return result;
      } catch (error) {
        attempts = [...attempts, ...attemptsFromFailure(error)];
        await recordTraceSafely(traceService, {
          id: runId,
          identity,
          ...(parsedInput.tripId ? { tripId: parsedInput.tripId } : {}),
          ...(intent ? { intent } : {}),
          status: "failed",
          inputDigest: digest(parsedInput.message),
          latencyMs: Date.now() - startedAt,
          attempts,
          validationStatus: "failed",
          repairCount,
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

function normalizeIntentDecision(
  value: CopilotIntent | CopilotIntentDecision,
): CopilotIntentDecision {
  return typeof value === "string" ? { intent: value } : value;
}

function parseGeneratedEnvelope(value: unknown): {
  envelope: CopilotEnvelope;
  attempts: AgentAttemptTrace[];
  repairCount: number;
} {
  const generated = isGeneratedEnvelope(value) ? value : { candidate: value };
  const candidates = repairCandidates(generated.candidate);
  let lastError: unknown;
  for (const [index, candidate] of candidates.entries()) {
    try {
      return {
        envelope: CopilotEnvelopeSchema.parse(normalizeEnvelopeCandidate(candidate)),
        attempts: generated.attempts ?? [],
        repairCount: index,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Copilot envelope validation failed.");
}

function repairCandidates(value: unknown): unknown[] {
  if (typeof value !== "string") return [value];
  const trimmed = value.trim();
  const extracted = trimmed.match(/\{[\s\S]*\}/)?.[0];
  return [trimmed, extracted]
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => candidate.replace(/,\s*([}\]])/g, "$1"))
    .map((candidate) => {
      try {
        return JSON.parse(candidate) as unknown;
      } catch {
        return candidate;
      }
    });
}

function normalizeEnvelopeCandidate(value: unknown): unknown {
  if (!isRecord(value) || typeof value.message !== "string") return value;
  const body = value.message.trim();
  if (body.length === 0) return value;
  return {
    ...value,
    message: {
      headline: "China travel answer",
      body,
      highlights: [],
    },
  };
}

function assertDemoDialogueEnvelope(envelope: CopilotEnvelope): CopilotEnvelope {
  if (
    envelope.tripActions.length > 0 ||
    envelope.commercialActions.length > 0 ||
    envelope.humanHelp !== null ||
    envelope.toolCards.length > 0 ||
    envelope.citations.length > 0
  ) {
    throw new Error("DEMO-01 only permits a dialogue envelope.");
  }
  return envelope;
}

function attemptsFromFailure(error: unknown): AgentAttemptTrace[] {
  if (
    typeof error !== "object" ||
    error === null ||
    !("attempts" in error) ||
    !Array.isArray(error.attempts)
  ) {
    return [];
  }
  return error.attempts.flatMap(toAgentAttemptTrace);
}

function toAgentAttemptTrace(value: unknown): AgentAttemptTrace[] {
  return typeof value === "object" &&
    value !== null &&
    "provider" in value &&
    "model" in value &&
    "status" in value &&
    "inputTokens" in value &&
    "outputTokens" in value &&
    "costUsd" in value &&
    "latencyMs" in value
    ? [value as AgentAttemptTrace]
    : isModelAttempt(value)
      ? [
          {
            provider: value.provider,
            model: value.model,
            status: value.ok ? "succeeded" : "failed",
            inputTokens: value.inputTokens ?? 0,
            outputTokens: value.outputTokens ?? 0,
            costUsd: value.costUsd ?? 0,
            latencyMs: value.latencyMs,
            ...(value.failureClass ? { failureClass: value.failureClass } : {}),
          },
        ]
      : [];
}

function isModelAttempt(value: unknown): value is {
  provider: string;
  model: string;
  ok: boolean;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  latencyMs: number;
  failureClass?: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "provider" in value &&
    "model" in value &&
    "ok" in value &&
    "latencyMs" in value
  );
}

function isGeneratedEnvelope(value: unknown): value is GeneratedEnvelope {
  return typeof value === "object" && value !== null && "candidate" in value;
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
  return [];
}

export function defaultGenerateEnvelope({
  currentTrip,
  intent,
  message,
  tripId,
  retrievedFacts,
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
      citations: citationsFor(retrievedFacts),
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
      citations: citationsFor(retrievedFacts),
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

  if (retrievedFacts.length === 0) {
    return {
      intent,
      message: {
        headline: "Not enough verified information yet",
        body: "I do not have verified evidence for that request yet, so I should not guess. Try a broader travel question or check back after the information is reviewed.",
        highlights: [],
      },
      citations: [],
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
    citations: citationsFor(retrievedFacts),
  };
}

async function retrieveEligibleFacts(
  knowledgeService: KnowledgeService,
  request: CopilotRequest,
  intent: CopilotIntent,
): Promise<RetrievalFact[]> {
  const city = detectCity(request.message);
  const category = detectCategory(request.message, intent);
  const pois = await knowledgeService.listPois({
    ...(city ? { city } : {}),
    ...(category ? { category } : {}),
  });
  return pois
    .flatMap((poi) =>
      poi.facts.map((fact) => ({
        id: fact.id,
        label: `${poi.nameEn}: ${fact.factType}`,
        summary: boundedFactSummary(fact.value),
        source: fact.source,
        verifiedAt: fact.verifiedAt,
        confidence: fact.confidence,
      })),
    )
    .slice(0, 3)
    .map((fact) => RetrievalFactSchema.parse(fact));
}

function validateCitations(envelope: CopilotEnvelope, facts: RetrievalFact[]): CopilotEnvelope {
  const allowed = new Map(facts.map((fact) => [fact.id, fact]));
  return CopilotEnvelopeSchema.parse({
    ...envelope,
    citations: envelope.citations.map((citation) => {
      const fact = allowed.get(citation.fact_id);
      if (!fact) throw new Error("Citation does not reference retrieved evidence.");
      return { fact_id: fact.id, label: fact.label, source: fact.source };
    }),
  });
}

function citationsFor(facts: RetrievalFact[]) {
  return facts
    .slice(0, 1)
    .map((fact) => ({ fact_id: fact.id, label: fact.label, source: fact.source }));
}

function boundedFactSummary(value: Record<string, unknown>): string {
  const label = typeof value.label === "string" ? value.label : "Verified execution fact";
  return label.slice(0, 240);
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

function detectCategory(message: string, intent: CopilotIntent) {
  if (/restaurant|food|eat|meal/i.test(message)) return "food" as const;
  if (/hotel|stay/i.test(message)) return "hotel" as const;
  if (/shop|shopping/i.test(message)) return "shopping" as const;
  if (/experience|spa|massage/i.test(message)) return "experience" as const;
  if (intent === "commerce_intent" || /ticket|attraction|museum|garden/i.test(message)) {
    return "attraction" as const;
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
