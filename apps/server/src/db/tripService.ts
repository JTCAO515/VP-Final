import { TripPatchSchema, TripStateSchema, diffTrips } from "@visepanda/domain";
import { eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { tripEvents, trips, users } from "./schema.js";
import {
  normalizeOwner,
  ownerMatches,
  type TripEventSource,
  type TripOwner,
  type TripService,
} from "../modules/trip/service.js";

export function createDbTripService(db: Db): TripService {
  return {
    async create(trip, options) {
      return this.save(trip, { ...options, source: options?.source ?? "user_manual" });
    },
    async save(trip, options = {}) {
      const normalizedTrip = TripStateSchema.parse(trip);
      const owner = normalizeOwner(options.owner);
      const existingRow = await getTripRow(db, normalizedTrip.id);
      const existingTrip = existingRow ? TripStateSchema.parse(existingRow.snapshotJsonb) : null;

      if (!existingRow && !owner) {
        throw new Error("Trip owner is required when creating a trip");
      }

      const patch = TripPatchSchema.parse(options.patch ?? diffTrips(existingTrip, normalizedTrip));
      const source = options.source ?? "ai_copilot";
      const nextVersion = (existingRow?.headVersion ?? 0) + (patch.operations.length > 0 ? 1 : 0);

      await db.transaction(async (tx) => {
        if (owner?.userId) await ensureUser(tx, owner);

        if (existingRow) {
          await tx
            .update(trips)
            .set({
              snapshotJsonb: normalizedTrip,
              headVersion: nextVersion,
              ...(owner?.userId ? { owner: owner.userId, anonId: null } : {}),
              ...(owner?.anonId ? { anonId: owner.anonId } : {}),
            })
            .where(eq(trips.id, normalizedTrip.id));
        } else {
          await tx.insert(trips).values({
            id: normalizedTrip.id,
            owner: owner?.userId ?? null,
            anonId: owner?.anonId ?? null,
            snapshotJsonb: normalizedTrip,
            headVersion: nextVersion,
          });
        }

        if (patch.operations.length > 0) {
          await tx.insert(tripEvents).values({
            tripId: normalizedTrip.id,
            version: nextVersion,
            patchJsonb: patch,
            source,
          });
        }
      });

      return normalizedTrip;
    },
    async get(id, owner) {
      const row = await getTripRow(db, id);
      if (!row) return null;
      if (owner && !ownerMatches(rowOwner(row), owner)) return null;
      return TripStateSchema.parse(row.snapshotJsonb);
    },
    async list(owner) {
      const rows = await db.select().from(trips);
      return rows
        .filter((row) => ownerMatches(rowOwner(row), owner))
        .map((row) => TripStateSchema.parse(row.snapshotJsonb));
    },
    async claimAnonymousTrips({ anonId, userId, email }) {
      await ensureUser(db, { userId, email });
      const rows = await db
        .update(trips)
        .set({ owner: userId, anonId: null })
        .where(eq(trips.anonId, anonId))
        .returning({ snapshotJsonb: trips.snapshotJsonb });

      return {
        claimed: rows.length,
        trips: rows.map((row) => TripStateSchema.parse(row.snapshotJsonb)),
      };
    },
    async getEvents(id) {
      const rows = await db
        .select()
        .from(tripEvents)
        .where(eq(tripEvents.tripId, id))
        .orderBy(tripEvents.version);
      return rows.map((row) => ({
        tripId: row.tripId,
        version: row.version,
        patch: TripPatchSchema.parse(row.patchJsonb),
        source: row.source as TripEventSource,
      }));
    },
  };
}

async function getTripRow(db: Db, id: string) {
  const [row] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  return row ?? null;
}

async function ensureUser(db: Pick<Db, "insert">, owner: TripOwner): Promise<void> {
  if (!owner.userId) return;
  await db
    .insert(users)
    .values({
      id: owner.userId,
      ...(owner.email ? { email: owner.email } : {}),
    })
    .onConflictDoNothing();
}

function rowOwner(row: { owner: string | null; anonId: string | null }): TripOwner {
  return {
    ...(row.owner ? { userId: row.owner } : {}),
    ...(row.anonId ? { anonId: row.anonId } : {}),
  };
}
