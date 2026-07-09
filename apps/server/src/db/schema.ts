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

export const pois = pgTable(
  "pois",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    city: text("city").notNull(),
    category: text("category").notNull(),
    nameEn: text("name_en").notNull(),
    nameZh: text("name_zh"),
    address: text("address"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    sourceIds: jsonb("source_ids").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cityCategoryIdx: index("pois_city_category_idx").on(table.city, table.category),
    categoryCheck: check(
      "pois_category_check",
      sql`${table.category} in ('food', 'attraction', 'hotel', 'shopping', 'experience')`,
    ),
  }),
);

export const poiFacts = pgTable(
  "poi_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poiId: uuid("poi_id")
      .notNull()
      .references(() => pois.id, { onDelete: "cascade" }),
    factType: text("fact_type").notNull(),
    valueJsonb: jsonb("value_jsonb").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    source: text("source").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    poiTypeIdx: index("poi_facts_poi_type_idx").on(table.poiId, table.factType),
    confidenceCheck: check(
      "poi_facts_confidence_check",
      sql`${table.confidence} >= 0 and ${table.confidence} <= 1`,
    ),
    versionCheck: check("poi_facts_version_check", sql`${table.version} > 0`),
  }),
);

export const knowledgeGaps = pgTable(
  "knowledge_gaps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionPattern: text("question_pattern").notNull(),
    frequency: integer("frequency").notNull().default(1),
    city: text("city"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusFrequencyIdx: index("knowledge_gaps_status_frequency_idx").on(
      table.status,
      table.frequency,
    ),
    frequencyCheck: check("knowledge_gaps_frequency_check", sql`${table.frequency} > 0`),
    statusCheck: check(
      "knowledge_gaps_status_check",
      sql`${table.status} in ('open', 'resolved', 'ignored')`,
    ),
  }),
);

export const poiCommercialLinks = pgTable(
  "poi_commercial_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poiId: uuid("poi_id")
      .notNull()
      .references(() => pois.id, { onDelete: "cascade" }),
    partner: text("partner").notNull(),
    url: text("url").notNull(),
    disclosure: text("disclosure").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    poiStatusIdx: index("poi_commercial_links_poi_status_idx").on(table.poiId, table.status),
    statusCheck: check(
      "poi_commercial_links_status_check",
      sql`${table.status} in ('active', 'inactive')`,
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

export const poisRelations = relations(pois, ({ many }) => ({
  facts: many(poiFacts),
  commercialLinks: many(poiCommercialLinks),
}));

export const poiFactsRelations = relations(poiFacts, ({ one }) => ({
  poi: one(pois, {
    fields: [poiFacts.poiId],
    references: [pois.id],
  }),
}));

export const poiCommercialLinksRelations = relations(poiCommercialLinks, ({ one }) => ({
  poi: one(pois, {
    fields: [poiCommercialLinks.poiId],
    references: [pois.id],
  }),
}));
