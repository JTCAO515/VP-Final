import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createVersionedInMemoryTripService } from "../trip/versionedService.js";
import { createInMemoryReadinessService } from "./service.js";

const trip = {
  id: "550e8400-e29b-41d4-a716-446655440011",
  title: "Shanghai",
  destinationCountry: "CN" as const,
  days: [],
};
const anonymous = { kind: "anonymous" as const, anonId: "readiness-router-anon" };

describe("readinessRouter", () => {
  it("persists an opted-in fixed assessment through the trusted Trip context", async () => {
    const tripService = createVersionedInMemoryTripService();
    await tripService.create(trip, anonymous, "user_manual");
    const caller = appRouter.createCaller({
      identity: anonymous,
      tripService,
      readinessService: createInMemoryReadinessService({ tripService }),
    });

    const saved = await caller.readiness.save({
      assessment: {
        version: 1,
        answers: [{ questionId: "payment_method", value: "confirmed" }],
        persistenceConsent: "granted",
      },
      tripId: trip.id,
    });

    const latest = await caller.readiness.latest({ tripId: trip.id });
    expect(latest).toMatchObject({ id: saved.id });
    expect(latest?.result.items).toContainEqual(
      expect.objectContaining({ questionId: "payment_method", status: "ready" }),
    );
  });

  it("rejects saving when consent is absent and fails closed when no service is composed", async () => {
    const tripService = createVersionedInMemoryTripService();
    const caller = appRouter.createCaller({ identity: anonymous, tripService });

    await expect(
      caller.readiness.save({
        assessment: { version: 1, answers: [], persistenceConsent: "declined" },
        tripId: trip.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.readiness.latest({ tripId: trip.id })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Readiness is unavailable.",
    });
  });
});
