import type { TripState } from "@visepanda/domain";

export type TripService = {
  create(trip: TripState): Promise<TripState>;
  save(trip: TripState): Promise<TripState>;
  get(id: string): Promise<TripState | null>;
};

export function createInMemoryTripService(seed: TripState[] = []): TripService {
  const trips = new Map(seed.map((trip) => [trip.id, trip]));

  return {
    async create(trip) {
      trips.set(trip.id, trip);
      return trip;
    },
    async save(trip) {
      trips.set(trip.id, trip);
      return trip;
    },
    async get(id) {
      return trips.get(id) ?? null;
    },
  };
}
