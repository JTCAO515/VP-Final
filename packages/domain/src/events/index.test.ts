import { describe, expect, it } from "vitest";
import {
  TelemetryActionSchema,
  TelemetryCaptureInputSchema,
  TelemetryEventSchema,
} from "./index.js";

const eventId = "00000000-0000-4000-8000-000000000101";
const clickId = "00000000-0000-4000-8000-000000000102";

describe("TelemetryEventSchema", () => {
  it("registers the accepted operational and Phase 0 action names", () => {
    expect(TelemetryActionSchema.parse("turn_completed")).toBe("turn_completed");
    expect(TelemetryActionSchema.parse("prompt_submitted")).toBe("prompt_submitted");
    expect(TelemetryActionSchema.parse("task_paid")).toBe("task_paid");
    expect(() => TelemetryActionSchema.parse("arbitrary_event")).toThrow();
  });

  it("parses a retained event with exactly one trusted identity", () => {
    const parsed = TelemetryEventSchema.parse({
      id: eventId,
      anon_id: "a".repeat(43),
      surface: "web",
      action: "poi_viewed",
      entity_type: "poi",
      entity_id: "shanghai.yu-garden",
      props_jsonb: { city: "Shanghai", category: "Attraction" },
      created_at: "2026-07-27T12:00:00.000Z",
      retention_expires_at: "2027-01-23T12:00:00.000Z",
    });

    expect(parsed.props_jsonb).toEqual({ city: "Shanghai", category: "Attraction" });
  });

  it("rejects ownerless, dual-identity, and expired-retention events", () => {
    const base = {
      id: eventId,
      surface: "server" as const,
      action: "turn_completed" as const,
      entity_type: "copilot_turn",
      created_at: "2026-07-27T12:00:00.000Z",
      retention_expires_at: "2027-01-23T12:00:00.000Z",
    };

    expect(() => TelemetryEventSchema.parse(base)).toThrow();
    expect(() =>
      TelemetryEventSchema.parse({
        ...base,
        user_id: "00000000-0000-4000-8000-000000000103",
        anon_id: "a".repeat(43),
      }),
    ).toThrow();
    expect(() =>
      TelemetryEventSchema.parse({
        ...base,
        anon_id: "a".repeat(43),
        retention_expires_at: base.created_at,
      }),
    ).toThrow();
  });

  it("enforces action-specific properties and click continuity", () => {
    const base = {
      id: eventId,
      anon_id: "a".repeat(43),
      surface: "server" as const,
      action: "outbound_clicked" as const,
      entity_type: "outbound_click",
      entity_id: clickId,
      created_at: "2026-07-27T12:00:00.000Z",
      retention_expires_at: "2027-01-23T12:00:00.000Z",
    };

    expect(() => TelemetryEventSchema.parse(base)).toThrow();
    expect(
      TelemetryEventSchema.parse({
        ...base,
        partner: "tripcom",
        click_id: clickId,
        props_jsonb: { city: "Shanghai", category: "hotel" },
      }).click_id,
    ).toBe(clickId);
    expect(() =>
      TelemetryEventSchema.parse({
        ...base,
        partner: "tripcom",
        click_id: clickId,
        props_jsonb: { provider: "not-allowed-for-outbound" },
      }),
    ).toThrow();
  });

  it("rejects restricted material even when nested", () => {
    expect(() =>
      TelemetryEventSchema.parse({
        id: eventId,
        anon_id: "a".repeat(43),
        surface: "web",
        action: "guide_viewed",
        entity_type: "guide",
        entity_id: "payment-guide",
        props_jsonb: { city: "traveler@example.com" },
        created_at: "2026-07-27T12:00:00.000Z",
        retention_expires_at: "2027-01-23T12:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("TelemetryCaptureInputSchema", () => {
  it("accepts only browser-safe actions and dimensions", () => {
    expect(
      TelemetryCaptureInputSchema.parse({
        action: "scene_filter_used",
        entity_type: "explore_filter",
        entity_id: "rainy-day",
        props_jsonb: { city: "Shanghai", category: "Attraction", scene: "Rainy day" },
      }).action,
    ).toBe("scene_filter_used");
    expect(() =>
      TelemetryCaptureInputSchema.parse({
        action: "prompt_submitted",
        entity_type: "copilot_turn",
      }),
    ).toThrow();
  });

  it("rejects client-supplied identity and persistence fields", () => {
    expect(() =>
      TelemetryCaptureInputSchema.parse({
        action: "guide_viewed",
        entity_type: "guide",
        entity_id: "payment-guide",
        user_id: "00000000-0000-4000-8000-000000000103",
        anon_id: "forged",
        id: eventId,
        created_at: "2026-07-27T12:00:00.000Z",
        retention_expires_at: "2027-01-23T12:00:00.000Z",
      }),
    ).toThrow();
  });
});
