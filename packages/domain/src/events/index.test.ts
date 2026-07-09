import { describe, expect, it } from "vitest";
import { TelemetryEventSchema } from "./index.js";

describe("TelemetryEventSchema", () => {
  it("parses the unified event shape", () => {
    const parsed = TelemetryEventSchema.parse({
      id: "event-1",
      anon_id: "anon-1",
      surface: "web",
      action: "copilot_submit",
      entity_type: "trip",
      entity_id: "trip-1",
      intent: "trip_create",
      created_at: "2026-07-09T12:00:00.000Z",
    });

    expect(parsed.props_jsonb).toEqual({});
  });
});
