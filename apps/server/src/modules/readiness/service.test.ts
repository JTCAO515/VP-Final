import { describe, expect, it } from "vitest";
import { createVersionedInMemoryTripService } from "../trip/versionedService.js";
import {
  createInMemoryReadinessService,
  DEFAULT_READINESS_RETENTION_DAYS,
  ReadinessTripNotFoundError,
  ReadinessTripRequiredError,
  resolveReadinessRetentionDays,
} from "./service.js";

const trip = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  title: "Shanghai",
  destinationCountry: "CN" as const,
  days: [{ id: "day-1", dayNumber: 1, city: "Shanghai", blocks: [] }],
};
const anonymous = { kind: "anonymous" as const, anonId: "readiness-anon" };
const stranger = { kind: "anonymous" as const, anonId: "readiness-stranger" };
const user = { kind: "authenticated" as const, userId: "readiness-user" };

describe("ReadinessService", () => {
  it("persists fixed self-reports only with consent and an owned Trip for an anonymous traveler", async () => {
    const tripService = createVersionedInMemoryTripService();
    await tripService.create(trip, anonymous, "user_manual");
    const service = createInMemoryReadinessService({
      tripService,
      now: () => new Date("2026-08-13T00:00:00.000Z"),
    });

    const saved = await service.save(
      {
        assessment: {
          version: 1,
          answers: [{ questionId: "payment_method", value: "confirmed" }],
          persistenceConsent: "granted",
        },
        tripId: trip.id,
      },
      anonymous,
    );

    expect(saved.result.items.find((item) => item.questionId === "payment_method")).toMatchObject({
      status: "ready",
      evidenceStatus: "self_reported",
    });
    await expect(service.latest(anonymous, { tripId: trip.id })).resolves.toMatchObject({
      id: saved.id,
    });
    await expect(service.latest(stranger, { tripId: trip.id })).rejects.toBeInstanceOf(
      ReadinessTripNotFoundError,
    );
  });

  it("does not create unowned anonymous readiness records", async () => {
    const service = createInMemoryReadinessService({
      tripService: createVersionedInMemoryTripService(),
    });

    await expect(
      service.save(
        {
          assessment: { version: 1, answers: [], persistenceConsent: "granted" },
        },
        anonymous,
      ),
    ).rejects.toBeInstanceOf(ReadinessTripRequiredError);
  });

  it("allows an authenticated traveler to save a consented account-level result", async () => {
    const service = createInMemoryReadinessService({
      tripService: createVersionedInMemoryTripService(),
      now: () => new Date("2026-08-13T00:00:00.000Z"),
    });

    const saved = await service.save(
      {
        assessment: {
          version: 1,
          answers: [{ questionId: "arrival_network", value: "not_confirmed" }],
          persistenceConsent: "granted",
        },
      },
      user,
    );

    await expect(service.latest(user)).resolves.toMatchObject({ id: saved.id });
  });

  it("stops returning an expired result and only permits retention shortening", async () => {
    let current = new Date("2026-08-13T00:00:00.000Z");
    const service = createInMemoryReadinessService({
      tripService: createVersionedInMemoryTripService(),
      now: () => current,
      retentionDays: 1,
    });
    await service.save(
      {
        assessment: { version: 1, answers: [], persistenceConsent: "granted" },
      },
      user,
    );
    current = new Date("2026-08-14T00:00:00.000Z");
    await expect(service.latest(user)).resolves.toBeNull();
    expect(resolveReadinessRetentionDays({})).toBe(DEFAULT_READINESS_RETENTION_DAYS);
    expect(resolveReadinessRetentionDays({ VISEPANDA_READINESS_RETENTION_DAYS: "30" })).toBe(30);
    expect(() =>
      resolveReadinessRetentionDays({ VISEPANDA_READINESS_RETENTION_DAYS: "181" }),
    ).toThrow("must be between 1 and 180");
  });
});
