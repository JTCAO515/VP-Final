export const DEMO_MODEL_ROUTES = [
  "router_primary",
  "router_fallback",
  "concierge_primary",
  "concierge_fallback",
  "concierge_tertiary",
  "planning_primary",
  "planning_fallback",
  "extraction_primary",
] as const;

export type DemoModelRoute = (typeof DEMO_MODEL_ROUTES)[number];

type ProviderName = "dashscope" | "deepseek" | "moonshot" | "zhipu";

type ProviderDefinition = {
  keyEnvironment: string;
  baseUrlEnvironment: string;
  defaultBaseUrl: string;
};

const PROVIDERS: Record<ProviderName, ProviderDefinition> = {
  dashscope: {
    keyEnvironment: "DASHSCOPE_API_KEY",
    baseUrlEnvironment: "DASHSCOPE_BASE_URL",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  deepseek: {
    keyEnvironment: "DEEPSEEK_API_KEY",
    baseUrlEnvironment: "DEEPSEEK_BASE_URL",
    defaultBaseUrl: "https://api.deepseek.com/v1",
  },
  moonshot: {
    keyEnvironment: "MOONSHOT_API_KEY",
    baseUrlEnvironment: "MOONSHOT_BASE_URL",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
  },
  zhipu: {
    keyEnvironment: "ZHIPU_API_KEY",
    baseUrlEnvironment: "ZHIPU_BASE_URL",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
  },
};

const ROUTE_PROVIDER: Record<DemoModelRoute, ProviderName> = {
  router_primary: "dashscope",
  router_fallback: "deepseek",
  concierge_primary: "moonshot",
  concierge_fallback: "zhipu",
  concierge_tertiary: "deepseek",
  planning_primary: "deepseek",
  planning_fallback: "moonshot",
  extraction_primary: "dashscope",
};

export type DemoModelRouteConfig = {
  route: DemoModelRoute;
  provider: ProviderName;
  model: string;
  baseUrl: string;
  apiKey: string;
};

export type ProviderReadiness = {
  route: DemoModelRoute;
  provider: ProviderName;
  modelEnvironment: string;
  keyEnvironment: string;
  status: "ready" | "missing_model" | "missing_key";
};

export function resolveDemoModelRoute(
  environment: Readonly<Record<string, string | undefined>>,
  route: DemoModelRoute,
): DemoModelRouteConfig | null {
  const provider = ROUTE_PROVIDER[route];
  const definition = PROVIDERS[provider];
  const model = environment[modelEnvironmentName(route)];
  const apiKey = environment[definition.keyEnvironment];
  if (!model || !apiKey) return null;
  return {
    route,
    provider,
    model,
    apiKey,
    baseUrl: environment[definition.baseUrlEnvironment] ?? definition.defaultBaseUrl,
  };
}

export function inspectDemoProviderReadiness(
  environment: Readonly<Record<string, string | undefined>>,
): ProviderReadiness[] {
  return DEMO_MODEL_ROUTES.map((route) => {
    const provider = ROUTE_PROVIDER[route];
    const definition = PROVIDERS[provider];
    const modelEnvironment = modelEnvironmentName(route);
    return {
      route,
      provider,
      modelEnvironment,
      keyEnvironment: definition.keyEnvironment,
      status: !environment[modelEnvironment]
        ? "missing_model"
        : environment[definition.keyEnvironment]
          ? "ready"
          : "missing_key",
    };
  });
}

export function planningRewriteEnabled(environment: Readonly<Record<string, string | undefined>>) {
  return environment.PLANNING_REWRITE_ENABLED === "true";
}

function modelEnvironmentName(route: DemoModelRoute): string {
  return `VISEPANDA_MODEL_${route.toUpperCase()}`;
}
