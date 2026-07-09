import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createInMemoryTripService } from "./service.js";

const trip = {
  id: "trip-shanghai",
  title: "Shanghai",
  destinationCountry: "CN" as const,
  days: [],
};

describe("tripRouter", () => {
  it("creates and reads trips through the tRPC caller", async () => {
    const caller = appRouter.createCaller({
      tripService: createInMemoryTripService(),
    });

    await expect(caller.trip.create(trip)).resolves.toEqual(trip);
    await expect(caller.trip.get({ id: trip.id })).resolves.toEqual(trip);
  });
});
