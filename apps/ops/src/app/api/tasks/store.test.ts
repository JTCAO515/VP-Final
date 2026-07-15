import { createInMemoryHumanTaskService } from "@visepanda/app-server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getHumanTaskService, setTestOpsHumanTaskService } from "./store";

beforeEach(() => {
  process.env.VISEPANDA_RUNTIME_MODE = "test";
});

afterEach(() => {
  delete process.env.VISEPANDA_RUNTIME_MODE;
  setTestOpsHumanTaskService(null);
});

describe("ops human task store", () => {
  it("reads the same owner-scoped request through the Ops queue", async () => {
    const service = createInMemoryHumanTaskService();
    setTestOpsHumanTaskService(service);
    await service.create({
      identity: { kind: "anonymous", anonId: "anon-a" },
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      request: {
        city: "Shanghai",
        kind: "translation_help",
        description: "Please help explain this hotel request in Chinese to the front desk.",
        contact: "traveler@example.com",
      },
    });

    await expect(getHumanTaskService().listForOps()).resolves.toEqual([
      expect.objectContaining({ status: "requested", contact: "traveler@example.com" }),
    ]);
  });

  it("fails closed when test composition is not injected", () => {
    setTestOpsHumanTaskService(null);
    expect(() => getHumanTaskService()).toThrow("Ops test Human Tasks are not injected.");
  });
});
