import {
  createModelRouter,
  createOpenAiCompatibleProvider,
  resolveDemoModelRoute,
  type DemoModelRoute,
  type ModelAttempt,
  type ModelRequest,
} from "@visepanda/ai";

type Environment = Readonly<Record<string, string | undefined>>;

export type DemoModelChain = "router" | "concierge" | "planning";

export class DemoModelUnavailableError extends Error {
  readonly code = "MODEL_CONFIGURATION_UNAVAILABLE";

  constructor(readonly missingRoutes: DemoModelRoute[]) {
    super("The requested Copilot model route is not configured.");
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
            baseUrl: configuration.baseUrl,
            apiKey: configuration.apiKey,
            model: configuration.model,
            timeoutMs: 20_000,
            maxTokens: request.maxTokens ?? 1_200,
          });
        }),
      });
      const result = await router.generate(request);
      return { content: result.content, attempts: result.attempts };
    },
  };
}
