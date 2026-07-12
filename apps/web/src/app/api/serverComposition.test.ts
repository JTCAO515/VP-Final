import {
  createInMemoryAgentTraceService,
  createInMemoryKnowledgeService,
  createVersionedInMemoryTripService,
} from "@visepanda/app-server";
import { afterEach, describe, expect, it } from "vitest";
import {
  createWebServerServices,
  setTestWebServerServices,
  WebRuntimeUnavailableError,
} from "./_server";
import { pendingDurableCapabilityResponse } from "./_runtimeError";

afterEach(() => setTestWebServerServices(null));

describe("Web server composition", () => {
  it("fails closed for missing mode and missing deployed database", () => {
    expect(() => createWebServerServices({})).toThrowError(
      expect.objectContaining({ reason: "runtime_mode_missing" }),
    );
    expect(() => createWebServerServices({ VISEPANDA_RUNTIME_MODE: "production" })).toThrowError(
      expect.objectContaining({ reason: "database_url_missing" }),
    );
  });

  it("requires explicit test services", () => {
    expect(() => createWebServerServices({ VISEPANDA_RUNTIME_MODE: "test" })).toThrowError(
      WebRuntimeUnavailableError,
    );

    const injected = {
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: createInMemoryAgentTraceService(),
      tripService: createVersionedInMemoryTripService(),
    };
    setTestWebServerServices(injected);
    expect(createWebServerServices({ VISEPANDA_RUNTIME_MODE: "test" })).toBe(injected);
  });

  it("allows labelled local demo memory only when explicitly selected", () => {
    expect(createWebServerServices({ VISEPANDA_RUNTIME_MODE: "local-demo" })).toMatchObject({
      knowledgeService: expect.any(Object),
      tripService: expect.any(Object),
    });
  });

  it("quarantines pending ledgers in deployed modes", async () => {
    const unavailable = pendingDurableCapabilityResponse("Human Help", {
      VISEPANDA_RUNTIME_MODE: "production",
    });
    expect(unavailable?.status).toBe(503);
    await expect(unavailable?.json()).resolves.toMatchObject({
      code: "CAPABILITY_UNAVAILABLE",
    });
    expect(
      pendingDurableCapabilityResponse("Human Help", { VISEPANDA_RUNTIME_MODE: "local-demo" }),
    ).toBeNull();
  });
});
