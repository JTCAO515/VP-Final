import {
  createInMemoryAgentTraceService,
  createInMemoryEarlyAccessRateLimiter,
  createInMemoryEarlyAccessConfirmationEmailSender,
  createInMemoryEarlyAccessSignupService,
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createVersionedInMemoryTripService,
  type EarlyAccessSignupService,
  type EarlyAccessConfirmationEmailSender,
} from "@visepanda/app-server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestWebServerServices } from "../_server";
import { hashEarlyAccessClientAddress } from "./ipHash";
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
  delete process.env.VERCEL;
  setTestWebServerServices(null);
});

describe("POST /api/early-access", () => {
  it("normalizes and persists the first submission, then reports a duplicate idempotently", async () => {
    const service = createInMemoryEarlyAccessSignupService();
    const send = vi.fn().mockResolvedValue(undefined);
    inject(service, { send });

    const first = await POST(postRequest({ email: " Traveler@Example.COM " }));
    const duplicate = await POST(postRequest({ email: "traveler@example.com" }));

    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody).toEqual({ ok: true, status: "subscribed" });
    expect(JSON.stringify(firstBody)).not.toContain("traveler@example.com");
    expect(duplicate.status).toBe(200);
    await expect(duplicate.json()).resolves.toEqual({ ok: true, status: "already_subscribed" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid input without invoking the durable signup service", async () => {
    const service = failingService();
    inject(service);

    const response = await POST(postRequest({ email: "not-an-email" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Enter a valid email address.",
    });
  });

  it("rejects malformed JSON as invalid input rather than claiming service unavailability", async () => {
    const response = await POST(
      new Request("https://example.test/api/early-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Enter a valid email address.",
    });
  });

  it("silently discards a filled honeypot without a durable write", async () => {
    const service = failingService();
    inject(service);

    const response = await POST(postRequest({ company: "bot company" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: "subscribed" });
  });

  it("fails before a durable write when the confirmation sender is unavailable", async () => {
    const submit = vi.fn();
    inject({ submit }, null);

    const response = await POST(postRequest({ email: "traveler@example.com" }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "EARLY_ACCESS_CONFIRMATION_UNAVAILABLE",
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it("does not claim delivery when the provider fails after the durable signup", async () => {
    const service = createInMemoryEarlyAccessSignupService();
    const send = vi.fn().mockRejectedValue(new Error("provider unavailable"));
    inject(service, { send });

    const failedDelivery = await POST(postRequest({ email: "traveler@example.com" }));
    const duplicate = await POST(postRequest({ email: "traveler@example.com" }));

    expect(failedDelivery.status).toBe(502);
    await expect(failedDelivery.json()).resolves.toEqual({
      ok: false,
      code: "EARLY_ACCESS_CONFIRMATION_DELIVERY_FAILED",
      error: "Your Early Access signup was saved, but we could not send a confirmation email.",
    });
    expect(duplicate.status).toBe(200);
    await expect(duplicate.json()).resolves.toEqual({ ok: true, status: "already_subscribed" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("limits the sixth request before durable storage and ignores spoofed forwarding headers", async () => {
    const service = createInMemoryEarlyAccessSignupService();
    inject(service);
    process.env.VERCEL = "1";
    for (let index = 0; index < 5; index += 1) {
      await expect(
        POST(
          postRequest(
            { email: `traveler${index}@example.com` },
            { trustedIp: "203.0.113.8", spoofedIp: "198.51.100.77" },
          ),
        ),
      ).resolves.toHaveProperty("status", 200);
    }

    const blocked = await POST(
      postRequest(
        { email: "sixth@example.com" },
        { trustedIp: "203.0.113.8", spoofedIp: "198.51.100.77" },
      ),
    );

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("3600");
    await expect(blocked.json()).resolves.toMatchObject({
      ok: false,
      code: "EARLY_ACCESS_RATE_LIMITED",
    });
  });

  it("fails honestly when trusted platform evidence or persistence is unavailable", async () => {
    process.env.VERCEL = "1";
    const missingTrustedAddress = await POST(postRequest({ email: "traveler@example.com" }));
    expect(missingTrustedAddress.status).toBe(503);

    inject(failingService());
    delete process.env.VERCEL;
    const failedPersistence = await POST(postRequest({ email: "traveler@example.com" }));
    expect(failedPersistence.status).toBe(503);

    inject();
    delete process.env.VISEPANDA_IP_HASH_SALT;
    const missingHashSalt = await POST(postRequest({ email: "second@example.com" }));
    expect(missingHashSalt.status).toBe(503);
  });

  it("hashes an address without retaining the raw address or server secret", () => {
    const ip = "203.0.113.8";
    const digest = hashEarlyAccessClientAddress(ip);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain(ip);
    expect(digest).not.toContain(hashSalt);
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

function failingService(): EarlyAccessSignupService {
  return { submit: async () => Promise.reject(new Error("database unavailable")) };
}

function postRequest(
  body: unknown,
  { trustedIp, spoofedIp }: { trustedIp?: string; spoofedIp?: string } = {},
) {
  return new Request("https://example.test/api/early-access", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(trustedIp ? { "x-vercel-forwarded-for": trustedIp } : {}),
      ...(spoofedIp ? { "x-forwarded-for": spoofedIp } : {}),
    },
    body: JSON.stringify(body),
  });
}
