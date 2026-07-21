import type { ModelAttemptCostSnapshot } from "@visepanda/ai";
import type { TripIdentity } from "../trip/versionedService.js";

export type AgentAttemptTrace = {
  route?: string;
  provider: string;
  model: string;
  status: "succeeded" | "failed";
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costSnapshot?: ModelAttemptCostSnapshot;
  latencyMs: number;
  failureClass?: string;
};

export type ToolCallTrace = {
  toolName: string;
  status: "succeeded" | "failed";
  inputDigest?: string;
  outputDigest?: string;
  latencyMs: number;
  failureClass?: string;
};

export type RecordAgentRunInput = {
  id: string;
  identity?: TripIdentity;
  tripId?: string;
  intent?: string;
  status: "succeeded" | "failed";
  inputDigest: string;
  outputDigest?: string;
  latencyMs: number;
  attempts: AgentAttemptTrace[];
  toolCalls?: ToolCallTrace[];
  validationStatus: "passed" | "failed";
  repairCount: number;
  failureClass?: string;
};

export interface AgentTraceService {
  recordRun(input: RecordAgentRunInput): Promise<void>;
}

export function createInMemoryAgentTraceService() {
  const runs: RecordAgentRunInput[] = [];
  return {
    async recordRun(input: RecordAgentRunInput) {
      runs.push(structuredClone(input));
    },
    listRuns() {
      return structuredClone(runs);
    },
  } satisfies AgentTraceService & { listRuns(): RecordAgentRunInput[] };
}

export function normalizeAgentFailure(error: unknown): string {
  if (error instanceof SyntaxError) return "parse_error";
  if (error instanceof Error && error.name === "ZodError") return "validation_error";
  if (error instanceof Error && /timeout/i.test(error.message)) return "timeout";
  return "internal_error";
}
