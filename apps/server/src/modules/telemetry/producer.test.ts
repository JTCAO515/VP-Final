import { describe, expect, it, vi } from "vitest";
import { recordTelemetrySafely } from "./producer.js";

describe("telemetry producer helper", () => {
  it("does not wait for a telemetry write that never settles", () => {
    const track = vi.fn(() => new Promise<never>(() => undefined));

    recordTelemetrySafely(
      { track },
      {
        anon_id: "a".repeat(43),
        surface: "server",
        action: "prompt_submitted",
        entity_type: "copilot_session",
        entity_id: "00000000-0000-5000-8000-000000000001",
      },
      "telemetry_write_failed",
    );

    expect(track).toHaveBeenCalledOnce();
  });

  it("does not throw when observation persistence rejects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    recordTelemetrySafely(
      {
        track: async () => {
          throw new Error("offline");
        },
      },
      {
        anon_id: "a".repeat(43),
        surface: "server",
        action: "prompt_submitted",
        entity_type: "copilot_session",
        entity_id: "00000000-0000-5000-8000-000000000001",
      },
      "telemetry_write_failed",
    );

    await Promise.resolve();
    expect(warn).toHaveBeenCalledWith("telemetry_write_failed", {
      failureClass: "persistence_error",
    });
  });
});
