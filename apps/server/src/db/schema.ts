import { relations } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    owner: uuid("owner")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    headVersion: integer("head_version").notNull().default(0),
    snapshotJsonb: jsonb("snapshot_jsonb").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("trips_owner_idx").on(table.owner),
    headVersionCheck: check("trips_head_version_check", sql`${table.headVersion} >= 0`),
  }),
);

export const tripEvents = pgTable(
  "trip_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    patchJsonb: jsonb("patch_jsonb").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tripVersionUnique: uniqueIndex("trip_events_trip_id_version_unique").on(
      table.tripId,
      table.version,
    ),
    versionCheck: check("trip_events_version_check", sql`${table.version} > 0`),
    sourceCheck: check(
      "trip_events_source_check",
      sql`${table.source} in ('user_chat', 'user_manual', 'ai_copilot', 'system')`,
    ),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  user: one(users, {
    fields: [trips.owner],
    references: [users.id],
  }),
  events: many(tripEvents),
}));

export const tripEventsRelations = relations(tripEvents, ({ one }) => ({
  trip: one(trips, {
    fields: [tripEvents.tripId],
    references: [trips.id],
  }),
}));
