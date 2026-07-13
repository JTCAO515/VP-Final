import { describe, expect, it } from "vitest";
import { createDemoModelRuntime, DemoModelUnavailableError } from "./modelRuntime.js";

describe("demo model runtime", () => {
  it("fails honestly when a route lacks its configured provider credentials", async () => {
    const runtime = createDemoModelRuntime({
      VISEPANDA_MODEL_ROUTER_PRIMARY: "catalog-confirmed-qwen",
    });

    await expect(
      runtime.generate("router", { task: "router", prompt: "classify", effort: "low" }),
    ).rejects.toEqual(expect.any(DemoModelUnavailableError));
  });
});
