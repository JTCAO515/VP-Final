import { randomBytes } from "node:crypto";
import {
  TripPatchSchema,
  TripStateSchema,
  applyPatch,
  diffTrips,
  type TripPatch,
  type TripState,
} from "@visepanda/domain";
import type { RequestIdentity } from "../../context.js";
import type { TripEvent, TripEventSource } from "./service.js";

export type TripIdentity = Exclude<RequestIdentity, { kind: "none" }>;
export type ClaimIdentity = Extract<RequestIdentity, { kind: "authenticated" }> & {
  anonId: string;
};

export type TripSnapshot = {
  trip: TripState;
  version: number;
};

export type ApplyTripPatchInput = {
  id: string;
  identity: TripIdentity;
  expectedVersion: number;
  patch: TripPatch;
  source: TripEventSource;
};

export type VersionedTripService = {
  create(trip: TripState, identity: TripIdentity, source: TripEventSource): Promise<TripSnapshot>;
  get(id: string, identity: TripIdentity): Promise<TripSnapshot | null>;
  list(identity: TripIdentity): Promise<TripSnapshot[]>;
  apply(input: ApplyTripPatchInput): Promise<TripSnapshot | null>;
  claim(identity: ClaimIdentity): Promise<{ claimed: number; trips: TripSnapshot[] }>;
  createShareToken(
    id: string,
    identity: TripIdentity,
  ): Promise<{ token: string; trip: TripState } | null>;
  revokeShareToken(id: string, identity: TripIdentity): Promise<boolean>;
  getByShareToken(token: string): Promise<TripState | null>;
  getEvents(id: string, identity: TripIdentity): Promise<TripEvent[] | null>;
};

export class TripVersionConflictError extends Error {
  readonly code = "TRIP_VERSION_CONFLICT";

  constructor(readonly currentVersion: number) {
    super("Trip changed since it was loaded.");
    this.name = "TripVersionConflictError";
  }
}

type StoredTrip = TripSnapshot & {
  owner:
    | { kind: "anonymous"; anonId: string }
    | { kind: "authenticated"; userId: string; email?: string };
  shareToken: string | null;
};

export function createVersionedInMemoryTripService(): VersionedTripService {
  const trips = new Map<string, StoredTrip>();
  const shareTokens = new Map<string, string>();
  const events = new Map<string, TripEvent[]>();

  return {
    async create(trip, identity, source) {
      const parsed = cloneTrip(trip);
      if (trips.has(parsed.id)) throw new Error("Trip already exists");
      const snapshot = { trip: parsed, version: 1 };
      trips.set(parsed.id, { ...snapshot, owner: ownerFromIdentity(identity), shareToken: null });
      events.set(parsed.id, [
        { tripId: parsed.id, version: 1, patch: diffTrips(null, parsed), source },
      ]);
      return cloneSnapshot(snapshot);
    },

    async get(id, identity) {
      const stored = trips.get(id);
      return stored && identityOwns(stored.owner, identity) ? cloneSnapshot(stored) : null;
    },

    async list(identity) {
      return [...trips.values()]
        .filter((stored) => identityOwns(stored.owner, identity))
        .map(cloneSnapshot);
    },

    async apply(input) {
      const stored = trips.get(input.id);
      if (!stored || !identityOwns(stored.owner, input.identity)) return null;
      if (stored.version !== input.expectedVersion) {
        throw new TripVersionConflictError(stored.version);
      }

      const patch = TripPatchSchema.parse(input.patch);
      if (patch.operations.length === 0) return cloneSnapshot(stored);
      const nextTrip = applyPatch(stored.trip, patch);
      if (nextTrip.id !== stored.trip.id) throw new Error("Trip patch cannot change the Trip id");
      const version = stored.version + 1;
      const next = { ...stored, trip: nextTrip, version };
      trips.set(input.id, next);
      events.set(input.id, [
        ...(events.get(input.id) ?? []),
        { tripId: input.id, version, patch, source: input.source },
      ]);
      return cloneSnapshot(next);
    },

    async claim(identity) {
      const claimed: TripSnapshot[] = [];
      for (const [id, stored] of trips) {
        if (stored.owner.kind !== "anonymous" || stored.owner.anonId !== identity.anonId) continue;
        const next: StoredTrip = {
          ...stored,
          owner: {
            kind: "authenticated",
            userId: identity.userId,
            ...(identity.email ? { email: identity.email } : {}),
          },
        };
        trips.set(id, next);
        claimed.push(cloneSnapshot(next));
      }
      return { claimed: claimed.length, trips: claimed };
    },

    async createShareToken(id, identity) {
      const stored = trips.get(id);
      if (!stored || !identityOwns(stored.owner, identity)) return null;
      const token = stored.shareToken ?? createTripShareTokenValue();
      stored.shareToken = token;
      shareTokens.set(token, id);
      return { token, trip: cloneTrip(stored.trip) };
    },

    async revokeShareToken(id, identity) {
      const stored = trips.get(id);
      if (!stored || !identityOwns(stored.owner, identity)) return false;
      if (stored.shareToken) shareTokens.delete(stored.shareToken);
      stored.shareToken = null;
      return true;
    },

    async getByShareToken(token) {
      const id = shareTokens.get(token);
      const stored = id ? trips.get(id) : null;
      return stored ? cloneTrip(stored.trip) : null;
    },

    async getEvents(id, identity) {
      const stored = trips.get(id);
      if (!stored || !identityOwns(stored.owner, identity)) return null;
      return (events.get(id) ?? []).map((event) => ({
        ...event,
        patch: TripPatchSchema.parse(structuredClone(event.patch)),
      }));
    },
  };
}

function ownerFromIdentity(identity: TripIdentity): StoredTrip["owner"] {
  return identity.kind === "anonymous"
    ? { kind: "anonymous", anonId: identity.anonId }
    : {
        kind: "authenticated",
        userId: identity.userId,
        ...(identity.email ? { email: identity.email } : {}),
      };
}

function identityOwns(owner: StoredTrip["owner"], identity: TripIdentity): boolean {
  return (
    owner.kind === identity.kind &&
    (owner.kind === "anonymous"
      ? owner.anonId === (identity.kind === "anonymous" ? identity.anonId : null)
      : owner.userId === (identity.kind === "authenticated" ? identity.userId : null))
  );
}

function cloneTrip(trip: TripState): TripState {
  return TripStateSchema.parse(structuredClone(trip));
}

function cloneSnapshot(snapshot: TripSnapshot): TripSnapshot {
  return { trip: cloneTrip(snapshot.trip), version: snapshot.version };
}

export function createTripShareTokenValue(): string {
  return `share_${randomBytes(32).toString("base64url")}`;
}
