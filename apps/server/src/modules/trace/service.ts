import type { ModelAttemptCostSnapshot } from "@visepanda/ai";
import type {
  ConversationRedactionClass,
  CopilotEnvelope,
  CopilotIntent,
  CopilotProductEventAction,
} from "@visepanda/domain";
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
  conversation?: {
    sessionId: string;
    userMessage: string;
    assistantEnvelope: CopilotEnvelope | null;
    cityIntent: string | null;
    redactionClasses: ConversationRedactionClass[];
  };
};

export type RecordCopilotProductEventInput = {
  identity: TripIdentity;
  action: CopilotProductEventAction;
  intent?: CopilotIntent;
  entityType: "copilot_session" | "copilot_turn" | "model_attempt";
  entityId: string;
  props?: Record<string, unknown>;
  createdAt?: Date;
};

export interface AgentTraceService {
  recordRun(input: RecordAgentRunInput): Promise<void>;
}

export interface CopilotProductEventService {
  recordProductEvent(input: RecordCopilotProductEventInput): Promise<void>;
}

export function createInMemoryAgentTraceService() {
  const runs: RecordAgentRunInput[] = [];
  const productEvents: RecordCopilotProductEventInput[] = [];
  return {
    async recordRun(input: RecordAgentRunInput) {
      runs.push(structuredClone(input));
    },
    listRuns() {
      return structuredClone(runs);
    },
    async recordProductEvent(input: RecordCopilotProductEventInput) {
      productEvents.push(structuredClone(input));
    },
    listProductEvents() {
      return structuredClone(productEvents);
    },
  } satisfies AgentTraceService &
    CopilotProductEventService & {
      listRuns(): RecordAgentRunInput[];
      listProductEvents(): RecordCopilotProductEventInput[];
    };
}

export function normalizeAgentFailure(error: unknown): string {
  if (error instanceof SyntaxError) return "parse_error";
  if (error instanceof Error && error.name === "ZodError") return "validation_error";
  if (
    error instanceof Error &&
    (error.name === "CopilotEnvelopeValidationError" || error.name === "DemoModelResponseError")
  ) {
    return "validation_error";
  }
  if (error instanceof Error && /timeout/i.test(error.message)) return "timeout";
  return "internal_error";
}
