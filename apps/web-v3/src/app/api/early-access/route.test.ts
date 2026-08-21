import {
  createInMemoryAgentTraceService,
  createInMemoryEarlyAccessConfirmationEmailSender,
  createInMemoryEarlyAccessRateLimiter,
  createInMemoryEarlyAccessSignupService,
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createVersionedInMemoryTripService,
  type EarlyAccessConfirmationEmailSender,
  type EarlyAccessSignupService,
} from "@visepanda/app-server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestWebServerServices } from "../_server";
import { POST } from "./route";

const hashSalt = "x".repeat(32);

beforeEach(() => {
  process.env.VISEPANDA_RUNTIME_MODE = "test";
  process.env.VISEPANDA_IP_HASH_SALT = hashSalt;
  inject();
});

afterEach(() => {
  delete process.env.VISEPANDA_RUNTIME_MODE;
  delete process.env.VISEPANDA_IP_HASH_SALT;
  setTestWebServerServices(null);
});

describe("V3 POST /api/early-access", () => {
  it("uses the shared first-submit, duplicate, and one-email contract", async () => {
    const service = createInMemoryEarlyAccessSignupService();
    const send = vi.fn().mockResolvedValue(undefined);
    inject(service, { send });

    const first = await POST(postRequest({ email: " Traveler@Example.COM " }));
    const duplicate = await POST(postRequest({ email: "traveler@example.com" }));

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ ok: true, status: "subscribed" });
    await expect(duplicate.json()).resolves.toEqual({ ok: true, status: "already_subscribed" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps missing confirmation and failed delivery honest", async () => {
    const submit = vi.fn();
    inject({ submit }, null);
    const unavailable = await POST(postRequest({ email: "traveler@example.com" }));
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toMatchObject({
      code: "EARLY_ACCESS_CONFIRMATION_UNAVAILABLE",
    });
    expect(submit).not.toHaveBeenCalled();

    const service = createInMemoryEarlyAccessSignupService();
    inject(service, { send: vi.fn().mockRejectedValue(new Error("provider unavailable")) });
    const failed = await POST(postRequest({ email: "second@example.com" }));
    expect(failed.status).toBe(502);
    await expect(failed.json()).resolves.toMatchObject({
      code: "EARLY_ACCESS_CONFIRMATION_DELIVERY_FAILED",
    });
  });
});

function inject(
  service: EarlyAccessSignupService = createInMemoryEarlyAccessSignupService(),
  emailSender: EarlyAccessConfirmationEmailSender | null = createInMemoryEarlyAccessConfirmationEmailSender(),
) {
  setTestWebServerServices({
    humanTaskService: createInMemoryHumanTaskService(),
    knowledgeService: createInMemoryKnowledgeService(),
    traceService: createInMemoryAgentTraceService(),
    tripService: createVersionedInMemoryTripService(),
    earlyAccessSignupService: service,
    earlyAccessRateLimiter: createInMemoryEarlyAccessRateLimiter(),
    ...(emailSender ? { earlyAccessConfirmationEmailSender: emailSender } : {}),
  });
}

function postRequest(body: unknown) {
  return new Request("https://example.test/api/early-access", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
