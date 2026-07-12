import { describe, expect, it } from "vitest";
import {
  inspectDemoProviderReadiness,
  planningRewriteEnabled,
  resolveDemoModelRoute,
} from "./providerInventory.js";

describe("demo provider inventory", () => {
  it("uses model names only from environment and never exposes key values in readiness", () => {
    const environment = {
      DASHSCOPE_API_KEY: "secret-value",
      VISEPANDA_MODEL_ROUTER_PRIMARY: "catalog-confirmed-flash",
    };
    expect(resolveDemoModelRoute(environment, "router_primary")).toMatchObject({
      provider: "dashscope",
      model: "catalog-confirmed-flash",
    });
    expect(JSON.stringify(inspectDemoProviderReadiness(environment))).not.toContain("secret-value");
  });

  it("reports missing model and key separately", () => {
    const readiness = inspectDemoProviderReadiness({
      MOONSHOT_API_KEY: "secret",
      VISEPANDA_MODEL_CONCIERGE_PRIMARY: "catalog-confirmed-kimi",
    });
    expect(readiness.find((entry) => entry.route === "concierge_primary")?.status).toBe("ready");
    expect(readiness.find((entry) => entry.route === "planning_primary")?.status).toBe(
      "missing_model",
    );
  });

  it("keeps planning rewrite disabled unless explicitly enabled", () => {
    expect(planningRewriteEnabled({})).toBe(false);
    expect(planningRewriteEnabled({ PLANNING_REWRITE_ENABLED: "true" })).toBe(true);
  });
});
