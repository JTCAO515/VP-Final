import { afterEach, describe, expect, it, vi } from "vitest";
import { captureClientTelemetry } from "./clientTelemetry";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("captureClientTelemetry", () => {
  it("starts a best-effort capture without waiting for navigation", () => {
    const fetch = vi.fn(() => new Promise<never>(() => undefined));
    vi.stubGlobal("fetch", fetch);

    captureClientTelemetry({
      action: "poi_viewed",
      entity_type: "poi",
      entity_id: "yu-garden",
      props_jsonb: { city: "Shanghai", category: "attraction" },
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/telemetry",
      expect.objectContaining({ keepalive: true, method: "POST" }),
    );
  });
});
