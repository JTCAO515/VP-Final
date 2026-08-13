import { describe, expect, it } from "vitest";

import { captureMobileTelemetry } from "./mobileTelemetryAccess";

const event = {
  id: "00000000-0000-4000-8000-000000000601",
  action: "tool_opened" as const,
  entity_type: "tool",
  entity_id: "translation",
  props_jsonb: { tool: "translation" },
};

describe("mobile telemetry access", () => {
  it("rejects a missing session before parsing or tracking a client event", async () => {
    expect(
      await captureMobileTelemetry(null, event, {
        getUser: async () => ({ id: "ignored" }),
        track: async () => undefined,
      }),
    ).toEqual({ ok: false, status: 401, error: "Sign in is required to record mobile telemetry." });
  });

  it("derives the mobile identity from a verified bearer token and rejects content fields", async () => {
    const track = async (
      identity: { kind: "authenticated"; userId: string },
      received: typeof event,
    ) => {
      expect(identity).toEqual({ kind: "authenticated", userId: "user-1" });
      expect(received).toEqual(event);
    };
    await expect(
      captureMobileTelemetry("Bearer aaaaaaaaaaaaaaaaaaaa", event, {
        getUser: async () => ({ id: "user-1" }),
        track,
      }),
    ).resolves.toEqual({ ok: true });

    await expect(
      captureMobileTelemetry(
        "Bearer aaaaaaaaaaaaaaaaaaaa",
        { ...event, props_jsonb: { tool: "translation", prompt: "raw traveler text" } },
        { getUser: async () => ({ id: "user-1" }), track },
      ),
    ).resolves.toEqual({ ok: false, status: 400, error: "Invalid mobile telemetry event." });
  });
});
