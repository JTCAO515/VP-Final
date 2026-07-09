import {
  TripPatchSchema,
  TripStateSchema,
  diffTrips,
  type TripPatch,
  type TripState,
} from "@visepanda/domain";

export type TripEventSource = "user_chat" | "user_manual" | "ai_copilot" | "system";

export type TripOwner = {
  userId?: string | undefined;
  anonId?: string | undefined;
  email?: string | undefined;
};

export type TripEvent = {
  tripId: string;
  version: number;
  patch: TripPatch;
  source: TripEventSource;
};

export type TripSaveOptions = {
  owner?: TripOwner | undefined;
  patch?: TripPatch | undefined;
  source?: TripEventSource | undefined;
};

export type TripClaimInput = {
  anonId: string;
  userId: string;
  email?: string | undefined;
};

export type TripService = {
  create(trip: TripState, options?: TripSaveOptions): Promise<TripState>;
  save(trip: TripState, options?: TripSaveOptions): Promise<TripState>;
  get(id: string, owner?: TripOwner): Promise<TripState | null>;
  list(owner: TripOwner): Promise<TripState[]>;
  claimAnonymousTrips(input: TripClaimInput): Promise<{ claimed: number; trips: TripState[] }>;
  getEvents(id: string): Promise<TripEvent[]>;
};

export function createInMemoryTripService(seed: TripState[] = []): TripService {
  const trips = new Map(seed.map((trip) => [trip.id, trip]));
  const tripOwners = new Map<string, TripOwner>();
  const events = new Map<string, TripEvent[]>();

  for (const trip of seed) {
    const patch = diffTrips(null, trip);
    events.set(trip.id, [{ tripId: trip.id, version: 1, patch, source: "system" }]);
  }

  return {
    async create(trip, options) {
      return this.save(trip, { ...options, source: options?.source ?? "user_manual" });
    },
    async save(trip, options = {}) {
      const normalizedTrip = TripStateSchema.parse(trip);
      const existing = trips.get(normalizedTrip.id) ?? null;
      const owner = normalizeOwner(options.owner);
      if (!existing && !owner) {
        throw new Error("Trip owner is required when creating a trip");
      }

      const patch = options.patch ?? diffTrips(existing, normalizedTrip);
      TripPatchSchema.parse(patch);
      trips.set(normalizedTrip.id, normalizedTrip);
      if (owner) tripOwners.set(normalizedTrip.id, owner);

      if (patch.operations.length > 0) {
        const tripEvents = events.get(normalizedTrip.id) ?? [];
        tripEvents.push({
          tripId: normalizedTrip.id,
          version: tripEvents.length + 1,
          patch,
          source: options.source ?? "ai_copilot",
        });
        events.set(normalizedTrip.id, tripEvents);
      }

      return normalizedTrip;
    },
    async get(id, owner) {
      const trip = trips.get(id) ?? null;
      if (!trip || !owner) return trip;
      return ownerMatches(tripOwners.get(id), owner) ? trip : null;
    },
    async list(owner) {
      return [...trips.values()].filter((trip) => ownerMatches(tripOwners.get(trip.id), owner));
    },
    async claimAnonymousTrips({ anonId, userId, email }) {
      const claimed: TripState[] = [];
      for (const [tripId, owner] of tripOwners.entries()) {
        if (owner.anonId !== anonId) continue;
        tripOwners.set(tripId, { userId, email });
        const trip = trips.get(tripId);
        if (trip) claimed.push(trip);
      }
      return { claimed: claimed.length, trips: claimed };
    },
    async getEvents(id) {
      return events.get(id) ?? [];
    },
  };
}

export function normalizeOwner(owner: TripOwner | undefined): TripOwner | null {
  if (!owner?.userId && !owner?.anonId) return null;
  return {
    ...(owner.userId ? { userId: owner.userId } : {}),
    ...(owner.anonId ? { anonId: owner.anonId } : {}),
    ...(owner.email ? { email: owner.email } : {}),
  };
}

export function ownerMatches(stored: TripOwner | undefined, requested: TripOwner): boolean {
  if (!stored) return false;
  if (requested.userId && stored.userId === requested.userId) return true;
  if (requested.anonId && stored.anonId === requested.anonId) return true;
  return false;
}
