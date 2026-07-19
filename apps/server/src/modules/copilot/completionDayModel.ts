import { createHash } from "node:crypto";
import type { ModelAttempt, ModelRequest } from "@visepanda/ai";
import { TripBlockSchema } from "@visepanda/domain";
import { z } from "zod";
import type { AgentAttemptTrace, AgentTraceService } from "../trace/service.js";
import { normalizeAgentFailure } from "../trace/service.js";
import type { CompleteDay } from "./completionProcessor.js";
import { createDemoModelRuntime } from "./modelRuntime.js";

type Environment = Readonly<Record<string, string | undefined>>;
type PlanningRuntime = {
  generate(
    chain: "planning",
    request: ModelRequest,
  ): Promise<{
    content: string;
    attempts: ModelAttempt[];
  }>;
};

const GeneratedBlockSchema = TripBlockSchema.omit({ id: true, address: true, metadata: true })
  .extend({
    type: z.enum([
      "hotel",
      "attraction",
      "restaurant",
      "transport",
      "shopping",
      "experience",
      "free_time",
    ]),
  })
  .strict();

export function createModelCompleteDay({
  environment,
  traceService,
  runtime = createDemoModelRuntime(environment),
}: {
  environment: Environment;
  traceService?: AgentTraceService;
  runtime?: PlanningRuntime;
}): CompleteDay {
  return async (day, context) => {
    const startedAt = Date.now();
    const runId = crypto.randomUUID();
    let attempts: AgentAttemptTrace[] = [];
    try {
      const result = await runtime.generate("planning", {
        task: "trip_writer",
        effort: "high",
        maxTokens: 900,
        prompt: `Complete one day in a China itinerary. Return only one JSON object with this exact shape: {"type":"hotel|attraction|restaurant|transport|shopping|experience|free_time","title":"short executable activity","description":"practical detail","startTime":"optional HH:mm","endTime":"optional HH:mm","status":"planned|ready|needs_attention|done","notes":"optional caution"}. Do not include an address, booking claim, price, or availability because this request has no verified live source. Day context: ${JSON.stringify({ dayNumber: day.dayNumber, city: day.city, title: day.title, summary: day.summary })}`,
      });
      attempts = result.attempts.map(toTraceAttempt);
      const { block, repairCount } = parseGeneratedBlock(result.content, day.id);
      await recordTrace(traceService, {
        id: runId,
        identity: context.identity,
        tripId: context.tripId,
        intent: "trip_edit",
        status: "succeeded",
        inputDigest: digest(JSON.stringify(day)),
        outputDigest: digest(JSON.stringify(block)),
        latencyMs: Date.now() - startedAt,
        attempts,
        validationStatus: "passed",
        repairCount,
      });
      return block;
    } catch (error) {
      if (attempts.length === 0) attempts = attemptsFromError(error);
      await recordTrace(traceService, {
        id: runId,
        identity: context.identity,
        tripId: context.tripId,
        intent: "trip_edit",
        status: "failed",
        inputDigest: digest(JSON.stringify(day)),
        latencyMs: Date.now() - startedAt,
        attempts,
        validationStatus: "failed",
        repairCount: 0,
        failureClass: normalizeAgentFailure(error),
      });
      throw error;
    }
  };
}

export function parseGeneratedBlock(
  value: string,
  dayId: string,
): { block: ReturnType<typeof TripBlockSchema.parse>; repairCount: number } {
  const trimmed = value.trim();
  const extracted = trimmed.match(/\{[\s\S]*\}/)?.[0];
  const candidates = [trimmed, extracted]
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => candidate.replace(/,\s*([}\]])/g, "$1"));
  let lastError: unknown;
  for (const [index, candidate] of candidates.entries()) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      return {
        block: TripBlockSchema.parse({
          ...GeneratedBlockSchema.parse(parsed),
          id: `completion-${dayId}`,
        }),
        repairCount: index,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Completion block validation failed.");
}

function toTraceAttempt(attempt: ModelAttempt): AgentAttemptTrace {
  return {
    provider: attempt.provider,
    model: attempt.model,
    status: attempt.ok ? "succeeded" : "failed",
    inputTokens: attempt.inputTokens ?? 0,
    outputTokens: attempt.outputTokens ?? 0,
    costUsd: attempt.costUsd ?? 0,
    latencyMs: attempt.latencyMs,
    ...(attempt.failureClass ? { failureClass: attempt.failureClass } : {}),
  };
}

function attemptsFromError(error: unknown): AgentAttemptTrace[] {
  if (
    !error ||
    typeof error !== "object" ||
    !("attempts" in error) ||
    !Array.isArray(error.attempts)
  ) {
    return [];
  }
  return error.attempts.map((attempt) => toTraceAttempt(attempt as ModelAttempt));
}

async function recordTrace(
  service: AgentTraceService | undefined,
  input: Parameters<AgentTraceService["recordRun"]>[0],
): Promise<void> {
  if (!service) return;
  try {
    await service.recordRun(input);
  } catch {
    // Trace persistence cannot alter completion state.
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
