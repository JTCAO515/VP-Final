import { TripPatchSchema, TripStateSchema, applyPatch, diffTrips } from "@visepanda/domain";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "./client.js";
import { tripEvents, trips, users } from "./schema.js";
import {
  TripVersionConflictError,
  createTripShareTokenValue,
  type TripIdentity,
  type TripSnapshot,
  type VersionedTripService,
} from "../modules/trip/versionedService.js";

export function createDbVersionedTripService(db: Db): VersionedTripService {
  return {
    async create(trip, identity, source) {
      const parsed = TripStateSchema.parse(trip);
      return db.transaction(async (tx) => {
        await ensureAuthenticatedUser(tx, identity);
        await tx.insert(trips).values({
          id: parsed.id,
          ...ownerValues(identity),
          headVersion: 1,
          snapshotJsonb: parsed,
        });
        await tx.insert(tripEvents).values({
          tripId: parsed.id,
          version: 1,
          patchJsonb: diffTrips(null, parsed),
          source,
        });
        return cloneSnapshot({ trip: parsed, version: 1 });
      });
    },

    async get(id, identity) {
      const [row] = await db
        .select({ snapshotJsonb: trips.snapshotJsonb, headVersion: trips.headVersion })
        .from(trips)
        .where(and(eq(trips.id, id), ownerPredicate(identity)))
        .limit(1);
      return row ? snapshotFromRow(row) : null;
    },

    async list(identity) {
      const rows = await db
        .select({ snapshotJsonb: trips.snapshotJsonb, headVersion: trips.headVersion })
        .from(trips)
        .where(ownerPredicate(identity));
      return rows.map(snapshotFromRow);
    },

    async apply(input) {
      return db.transaction(async (tx) => {
        const [stored] = await tx
          .select({ snapshotJsonb: trips.snapshotJsonb, headVersion: trips.headVersion })
          .from(trips)
          .where(and(eq(trips.id, input.id), ownerPredicate(input.identity)))
          .limit(1);
        if (!stored) return null;
        if (stored.headVersion !== input.expectedVersion) {
          throw new TripVersionConflictError(stored.headVersion);
        }

        const patch = TripPatchSchema.parse(input.patch);
        if (patch.operations.length === 0) return snapshotFromRow(stored);
        const currentTrip = TripStateSchema.parse(stored.snapshotJsonb);
        const nextTrip = applyPatch(currentTrip, patch);
        if (nextTrip.id !== currentTrip.id) throw new Error("Trip patch cannot change the Trip id");
        const nextVersion = stored.headVersion + 1;
        const [updated] = await tx
          .update(trips)
          .set({ snapshotJsonb: nextTrip, headVersion: nextVersion })
          .where(
            and(
              eq(trips.id, input.id),
              ownerPredicate(input.identity),
              eq(trips.headVersion, input.expectedVersion),
            ),
          )
          .returning({ snapshotJsonb: trips.snapshotJsonb, headVersion: trips.headVersion });

        if (!updated) {
          const [current] = await tx
            .select({ headVersion: trips.headVersion })
            .from(trips)
            .where(and(eq(trips.id, input.id), ownerPredicate(input.identity)))
            .limit(1);
          if (!current) return null;
          throw new TripVersionConflictError(current.headVersion);
        }

        await tx.insert(tripEvents).values({
          tripId: input.id,
          version: nextVersion,
          patchJsonb: patch,
          source: input.source,
        });
        return snapshotFromRow(updated);
      });
    },

    async claim(identity) {
      return db.transaction(async (tx) => {
        await ensureAuthenticatedUser(tx, identity);
        const rows = await tx
          .update(trips)
          .set({ owner: identity.userId, anonId: null })
          .where(and(eq(trips.anonId, identity.anonId), isNull(trips.owner)))
          .returning({ snapshotJsonb: trips.snapshotJsonb, headVersion: trips.headVersion });
        return { claimed: rows.length, trips: rows.map(snapshotFromRow) };
      });
    },

    async createShareToken(id, identity) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .select({ snapshotJsonb: trips.snapshotJsonb, shareToken: trips.shareToken })
          .from(trips)
          .where(and(eq(trips.id, id), ownerPredicate(identity)))
          .limit(1)
          .for("update");
        if (!row) return null;
        const token = row.shareToken ?? createTripShareTokenValue();
        if (!row.shareToken) {
          await tx
            .update(trips)
            .set({ shareToken: token })
            .where(and(eq(trips.id, id), ownerPredicate(identity)));
        }
        return { token, trip: TripStateSchema.parse(row.snapshotJsonb) };
      });
    },

    async revokeShareToken(id, identity) {
      const rows = await db
        .update(trips)
        .set({ shareToken: null })
        .where(and(eq(trips.id, id), ownerPredicate(identity)))
        .returning({ id: trips.id });
      return rows.length === 1;
    },

    async getByShareToken(token) {
      const [row] = await db
        .select({ snapshotJsonb: trips.snapshotJsonb })
        .from(trips)
        .where(eq(trips.shareToken, token))
        .limit(1);
      return row ? TripStateSchema.parse(row.snapshotJsonb) : null;
    },

    async getEvents(id, identity) {
      const owned = await this.get(id, identity);
      if (!owned) return null;
      const rows = await db
        .select()
        .from(tripEvents)
        .where(eq(tripEvents.tripId, id))
        .orderBy(tripEvents.version);
      return rows.map((row) => ({
        tripId: row.tripId,
        version: row.version,
        patch: TripPatchSchema.parse(row.patchJsonb),
        source: row.source as "user_chat" | "user_manual" | "ai_copilot" | "system",
      }));
    },
  };
}

function ownerPredicate(identity: TripIdentity) {
  return identity.kind === "anonymous"
    ? and(eq(trips.anonId, identity.anonId), isNull(trips.owner))!
    : and(eq(trips.owner, identity.userId), isNull(trips.anonId))!;
}

function ownerValues(identity: TripIdentity) {
  return identity.kind === "anonymous"
    ? { owner: null, anonId: identity.anonId }
    : { owner: identity.userId, anonId: null };
}

async function ensureAuthenticatedUser(db: Pick<Db, "insert">, identity: TripIdentity) {
  if (identity.kind !== "authenticated") return;
  await db
    .insert(users)
    .values({ id: identity.userId, ...(identity.email ? { email: identity.email } : {}) })
    .onConflictDoNothing();
}

function snapshotFromRow(row: { snapshotJsonb: unknown; headVersion: number }): TripSnapshot {
  return cloneSnapshot({
    trip: TripStateSchema.parse(row.snapshotJsonb),
    version: row.headVersion,
  });
}

function cloneSnapshot(snapshot: TripSnapshot): TripSnapshot {
  return { trip: TripStateSchema.parse(structuredClone(snapshot.trip)), version: snapshot.version };
}
