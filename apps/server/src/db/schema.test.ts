import { describe, expect, it } from "vitest";
import { tripEvents, trips, users } from "./schema.js";

describe("database schema", () => {
  it("maps the v1 auth/trip tables", () => {
    expect(users.id.name).toBe("id");
    expect(trips.owner.name).toBe("owner");
    expect(tripEvents.tripId.name).toBe("trip_id");
  });
});
