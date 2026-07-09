import { relations } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
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

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tripId: uuid("trip_id").references(() => trips.id, { onDelete: "set null" }),
    intent: text("intent"),
    status: text("status").notNull(),
    inputJsonb: jsonb("input_jsonb").notNull().default({}),
    outputJsonb: jsonb("output_jsonb").notNull().default({}),
    error: text("error"),
    modelProvider: text("model_provider"),
    model: text("model"),
    effort: text("effort"),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    userCreatedIdx: index("agent_runs_user_created_idx").on(table.userId, table.createdAt),
    tripCreatedIdx: index("agent_runs_trip_created_idx").on(table.tripId, table.createdAt),
    statusCheck: check(
      "agent_runs_status_check",
      sql`${table.status} in ('started', 'succeeded', 'failed')`,
    ),
    effortCheck: check(
      "agent_runs_effort_check",
      sql`${table.effort} is null or ${table.effort} in ('low', 'medium', 'high')`,
    ),
    costCheck: check("agent_runs_cost_usd_check", sql`${table.costUsd} >= 0`),
  }),
);

export const toolCalls = pgTable(
  "tool_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentRunId: uuid("agent_run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    status: text("status").notNull(),
    inputJsonb: jsonb("input_jsonb").notNull().default({}),
    outputJsonb: jsonb("output_jsonb").notNull().default({}),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    agentRunStartedIdx: index("tool_calls_agent_run_started_idx").on(
      table.agentRunId,
      table.startedAt,
    ),
    statusCheck: check(
      "tool_calls_status_check",
      sql`${table.status} in ('started', 'succeeded', 'failed')`,
    ),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
  agentRuns: many(agentRuns),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  user: one(users, {
    fields: [trips.owner],
    references: [users.id],
  }),
  events: many(tripEvents),
  agentRuns: many(agentRuns),
}));

export const tripEventsRelations = relations(tripEvents, ({ one }) => ({
  trip: one(trips, {
    fields: [tripEvents.tripId],
    references: [trips.id],
  }),
}));

export const agentRunsRelations = relations(agentRuns, ({ one, many }) => ({
  user: one(users, {
    fields: [agentRuns.userId],
    references: [users.id],
  }),
  trip: one(trips, {
    fields: [agentRuns.tripId],
    references: [trips.id],
  }),
  toolCalls: many(toolCalls),
}));

export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
  agentRun: one(agentRuns, {
    fields: [toolCalls.agentRunId],
    references: [agentRuns.id],
  }),
}));
