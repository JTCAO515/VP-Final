import {
  createInMemoryAgentTraceService,
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createVersionedInMemoryTripService,
} from "@visepanda/app-server";
import { afterEach, describe, expect, it } from "vitest";
import {
  createWebServerServices,
  setTestWebServerServices,
  WebRuntimeUnavailableError,
} from "./app/api/_server";

afterEach(() => setTestWebServerServices(null));

describe("shared Web composition consumer", () => {
  it("preserves fail-closed deployed and explicit-test behavior", () => {
    expect(() => createWebServerServices({})).toThrowError(
      expect.objectContaining({ reason: "runtime_mode_missing" }),
    );
    expect(() => createWebServerServices({ VISEPANDA_RUNTIME_MODE: "production" })).toThrowError(
      expect.objectContaining({ reason: "database_url_missing" }),
    );
    expect(() => createWebServerServices({ VISEPANDA_RUNTIME_MODE: "test" })).toThrowError(
      WebRuntimeUnavailableError,
    );

    const injected = {
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: createInMemoryAgentTraceService(),
      tripService: createVersionedInMemoryTripService(),
    };
    setTestWebServerServices(injected);
    expect(createWebServerServices({ VISEPANDA_RUNTIME_MODE: "test" })).toBe(injected);
  });

  it("keeps labelled local-demo memory explicit", () => {
    expect(createWebServerServices({ VISEPANDA_RUNTIME_MODE: "local-demo" })).toMatchObject({
      humanTaskService: expect.any(Object),
      knowledgeService: expect.any(Object),
      readinessService: expect.any(Object),
      tripService: expect.any(Object),
    });
  });
});
