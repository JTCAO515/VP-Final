import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDemoModelRuntime,
  DemoModelExecutionError,
  DemoModelUnavailableError,
} from "./modelRuntime.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("demo model runtime", () => {
  it("fails honestly when a route lacks its configured provider credentials", async () => {
    const runtime = createDemoModelRuntime({
      VISEPANDA_MODEL_ROUTER_PRIMARY: "catalog-confirmed-qwen",
    });

    await expect(
      runtime.generate("router", { task: "router", prompt: "classify", effort: "low" }),
    ).rejects.toEqual(expect.any(DemoModelUnavailableError));
  });

  it("preserves safe failed attempts when every configured provider fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response("upstream detail", { status: 503 })),
    );
    const runtime = createDemoModelRuntime({
      DASHSCOPE_API_KEY: "test-dashscope-key",
      DEEPSEEK_API_KEY: "test-deepseek-key",
      VISEPANDA_MODEL_ROUTER_PRIMARY: "catalog-confirmed-qwen",
      VISEPANDA_MODEL_ROUTER_FALLBACK: "catalog-confirmed-deepseek",
    });

    await expect(
      runtime.generate("router", { task: "router", prompt: "classify", effort: "low" }),
    ).rejects.toMatchObject({
      name: DemoModelExecutionError.name,
      code: "MODEL_REQUEST_FAILED",
      attempts: [
        { provider: "router_primary", failureClass: "http_error" },
        { provider: "router_fallback", failureClass: "http_error" },
      ],
    });
  });
});
