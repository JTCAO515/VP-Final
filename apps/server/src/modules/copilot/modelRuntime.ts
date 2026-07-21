import {
  createModelRouter,
  createOpenAiCompatibleProvider,
  ModelRoutingError,
  planningRewriteEnabled,
  resolveDemoModelRoute,
  type DemoModelRoute,
  type ModelAttempt,
  type ModelRequest,
} from "@visepanda/ai";
import { CopilotIntentSchema, type CopilotIntent } from "@visepanda/domain";
import type { AgentAttemptTrace } from "../trace/service.js";
import type {
  CopilotGenerationRequest,
  CopilotIntentDecision,
  CopilotRequest,
  GeneratedEnvelope,
} from "./service.js";

type Environment = Readonly<Record<string, string | undefined>>;

export type DemoModelChain = "router" | "concierge" | "planning";

export class DemoModelUnavailableError extends Error {
  readonly code = "MODEL_CONFIGURATION_UNAVAILABLE";

  constructor(readonly missingRoutes: DemoModelRoute[]) {
    super("The requested Copilot model route is not configured.");
  }
}

export class DemoModelExecutionError extends Error {
  readonly code = "MODEL_REQUEST_FAILED";

  constructor(readonly attempts: ModelAttempt[]) {
    super("All configured Copilot model providers failed.");
    this.name = "DemoModelExecutionError";
  }
}

const CHAINS: Record<DemoModelChain, readonly DemoModelRoute[]> = {
  router: ["router_primary", "router_fallback"],
  concierge: ["concierge_primary", "concierge_fallback", "concierge_tertiary"],
  planning: ["planning_primary", "planning_fallback"],
};

export function createDemoModelRuntime(environment: Environment) {
  return {
    async generate(
      chain: DemoModelChain,
      request: ModelRequest,
    ): Promise<{
      content: string;
      attempts: ModelAttempt[];
    }> {
      const routes = CHAINS[chain];
      const configurations = routes.map((route) => resolveDemoModelRoute(environment, route));
      const missingRoutes = routes.filter((_, index) => !configurations[index]);
      if (missingRoutes.length > 0) throw new DemoModelUnavailableError(missingRoutes);

      const router = createModelRouter({
        providers: configurations.map((configuration) => {
          if (!configuration) throw new Error("unreachable");
          return createOpenAiCompatibleProvider({
            id: configuration.route,
            pricingProvider: configuration.provider,
            baseUrl: configuration.baseUrl,
            apiKey: configuration.apiKey,
            model: configuration.model,
            timeoutMs: 20_000,
            maxTokens: request.maxTokens ?? 1_200,
            ...(configuration.extraBody ? { extraBody: configuration.extraBody } : {}),
          });
        }),
      });
      try {
        const result = await router.generate(request);
        return { content: result.content, attempts: result.attempts };
      } catch (error) {
        if (error instanceof ModelRoutingError) {
          throw new DemoModelExecutionError(error.attempts);
        }
        throw error;
      }
    },
  };
}

export function createDemoCopilotModelDependencies(environment: Environment): {
  routeIntent(request: CopilotRequest): Promise<CopilotIntentDecision>;
  generateEnvelope(request: CopilotGenerationRequest): Promise<GeneratedEnvelope>;
} {
  const runtime = createDemoModelRuntime(environment);
  const rewritePlanning = planningRewriteEnabled(environment);
  return {
    async routeIntent(request) {
      const result = await runtime.generate("router", {
        task: "router",
        effort: "low",
        maxTokens: 80,
        prompt: `Classify this China travel message. Return only JSON: {"intent":"chat_only|trip_create|trip_edit|question|commerce_intent|human_help"}. Message: ${request.message}`,
      });
      return { intent: parseIntent(result.content), attempts: toTraceAttempts(result.attempts) };
    },
    async generateEnvelope(request) {
      const chain = isPlanningIntent(request.intent) ? "planning" : "concierge";
      const firstResult = await runtime.generate(chain, {
        task: chain === "planning" ? "trip_writer" : "knowledge_qa",
        effort: chain === "planning" ? "high" : "medium",
        maxTokens: chain === "planning" ? 1_600 : 900,
        prompt: `You are a China travel AI copilot. Return only a JSON Copilot envelope for this message: ${request.message}. Required shape: {"intent":"${request.intent}","message":{"headline":"short title","body":"helpful answer","highlights":["optional short point"]},"tripActions":[],"toolCards":[],"commercialActions":[],"humanHelp":null,"risk":{"level":"low","reason":null},"citations":[]}. DEMO-01 is dialogue-only: tripActions, toolCards, commercialActions, and citations must be empty arrays and humanHelp must be null.`,
      });
      if (chain !== "planning" || !rewritePlanning) {
        return { candidate: firstResult.content, attempts: toTraceAttempts(firstResult.attempts) };
      }

      const rewritten = await runtime.generate("concierge", {
        task: "trip_writer",
        effort: "medium",
        maxTokens: 1_600,
        prompt: `Polish this China travel Copilot envelope for clear natural English. Return only the JSON envelope, preserve intent \"${request.intent}\", and keep tripActions, toolCards, commercialActions, and citations empty with humanHelp null. Envelope: ${firstResult.content}`,
      });
      return {
        candidate: rewritten.content,
        attempts: toTraceAttempts([...firstResult.attempts, ...rewritten.attempts]),
      };
    },
  };
}

function parseIntent(content: string): CopilotIntent {
  const candidate = content.match(/\{[\s\S]*\}/)?.[0] ?? content;
  const parsed = JSON.parse(candidate) as { intent?: unknown };
  return CopilotIntentSchema.parse(parsed.intent);
}

function isPlanningIntent(intent: CopilotIntent): boolean {
  return intent === "trip_create" || intent === "trip_edit";
}

function toTraceAttempts(attempts: ModelAttempt[]): AgentAttemptTrace[] {
  return attempts.map((attempt) => ({
    route: attempt.route,
    provider: attempt.provider,
    model: attempt.model,
    status: attempt.ok ? "succeeded" : "failed",
    inputTokens: attempt.inputTokens ?? 0,
    outputTokens: attempt.outputTokens ?? 0,
    costUsd: attempt.costUsd ?? 0,
    costSnapshot: attempt.costSnapshot,
    latencyMs: attempt.latencyMs,
    ...(attempt.failureClass ? { failureClass: attempt.failureClass } : {}),
  }));
}
