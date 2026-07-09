import { z } from "zod";

export const TripBlockTypeSchema = z.enum([
  "hotel",
  "attraction",
  "restaurant",
  "transport",
  "shopping",
  "experience",
  "free_time",
  "emergency",
  "human_task",
]);

export const TripBlockSchema = z.object({
  id: z.string().min(1),
  type: TripBlockTypeSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(["planned", "ready", "needs_attention", "done"]).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const TripDaySchema = z.object({
  id: z.string().min(1),
  dayNumber: z.number().int().positive(),
  date: z.string().optional(),
  city: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  blocks: z.array(TripBlockSchema).default([]),
});

export const TripStateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  destinationCountry: z.literal("CN").default("CN"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  travelers: z.number().int().positive().optional(),
  days: z.array(TripDaySchema).default([]),
  updatedAt: z.string().optional(),
});

export type TripBlock = z.infer<typeof TripBlockSchema>;
export type TripDay = z.infer<typeof TripDaySchema>;
export type TripState = z.infer<typeof TripStateSchema>;

const TripStateFieldsSchema = TripStateSchema.omit({ id: true, days: true }).partial().strict();
const TripDayFieldsSchema = TripDaySchema.omit({ id: true, blocks: true }).partial().strict();
const TripBlockFieldsSchema = TripBlockSchema.omit({ id: true }).partial().strict();

export const TripPatchOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create_trip"), trip: TripStateSchema }),
  z.object({ op: z.literal("replace_trip"), trip: TripStateSchema }),
  z.object({ op: z.literal("update_trip"), fields: TripStateFieldsSchema }),
  z.object({ op: z.literal("upsert_day"), day: TripDaySchema }),
  z.object({
    op: z.literal("update_day"),
    dayId: z.string().min(1).optional(),
    dayNumber: z.number().int().positive().optional(),
    fields: TripDayFieldsSchema,
  }),
  z.object({
    op: z.literal("delete_day"),
    dayId: z.string().min(1).optional(),
    dayNumber: z.number().int().positive().optional(),
  }),
  z.object({
    op: z.literal("upsert_block"),
    dayId: z.string().min(1).optional(),
    dayNumber: z.number().int().positive().optional(),
    block: TripBlockSchema,
  }),
  z.object({
    op: z.literal("update_block"),
    dayId: z.string().min(1).optional(),
    dayNumber: z.number().int().positive().optional(),
    blockId: z.string().min(1),
    fields: TripBlockFieldsSchema,
  }),
  z.object({
    op: z.literal("delete_block"),
    dayId: z.string().min(1).optional(),
    dayNumber: z.number().int().positive().optional(),
    blockId: z.string().min(1),
  }),
]);

export const TripPatchSchema = z.object({
  operations: z.array(TripPatchOperationSchema),
});

export type TripPatchOperation = z.infer<typeof TripPatchOperationSchema>;
export type TripPatch = z.infer<typeof TripPatchSchema>;

export function applyPatch(current: TripState | null, patch: TripPatch): TripState {
  const parsedPatch = TripPatchSchema.parse(patch);
  let next = current ? cloneTrip(current) : null;

  for (const operation of parsedPatch.operations) {
    switch (operation.op) {
      case "create_trip":
        if (next) throw new Error("create_trip requires an empty current trip");
        next = normalizeTrip(operation.trip);
        break;
      case "replace_trip":
        next = normalizeTrip(operation.trip);
        break;
      case "update_trip":
        next = requireTrip(next, operation.op);
        next = normalizeTrip(withDefinedFields(next, operation.fields));
        break;
      case "upsert_day":
        next = requireTrip(next, operation.op);
        next = upsertDay(next, operation.day);
        break;
      case "update_day":
        next = requireTrip(next, operation.op);
        next = updateDay(next, operation);
        break;
      case "delete_day":
        next = requireTrip(next, operation.op);
        next = deleteDay(next, operation);
        break;
      case "upsert_block":
        next = requireTrip(next, operation.op);
        next = updateDayBlocks(next, operation, (blocks) =>
          upsertById(blocks, TripBlockSchema.parse(operation.block)),
        );
        break;
      case "update_block":
        next = requireTrip(next, operation.op);
        next = updateDayBlocks(next, operation, (blocks) => {
          const index = blocks.findIndex((block) => block.id === operation.blockId);
          if (index < 0) throw new Error(`TripBlock not found: ${operation.blockId}`);
          const existing = blocks[index];
          if (!existing) throw new Error(`TripBlock not found: ${operation.blockId}`);
          const updated = TripBlockSchema.parse({ ...existing, ...operation.fields });
          return replaceAt(blocks, index, updated);
        });
        break;
      case "delete_block":
        next = requireTrip(next, operation.op);
        next = updateDayBlocks(next, operation, (blocks) =>
          blocks.filter((block) => block.id !== operation.blockId),
        );
        break;
    }
  }

  return normalizeTrip(requireTrip(next, "applyPatch"));
}

export function diffTrips(previous: TripState | null, next: TripState): TripPatch {
  const normalizedNext = normalizeTrip(next);
  if (!previous) return { operations: [{ op: "create_trip", trip: normalizedNext }] };

  const normalizedPrevious = normalizeTrip(previous);
  if (sameJson(normalizedPrevious, normalizedNext)) {
    return { operations: [] };
  }

  const operations: TripPatchOperation[] = [];
  for (const oldDay of normalizedPrevious.days) {
    if (!normalizedNext.days.some((day) => day.id === oldDay.id)) {
      operations.push({ op: "delete_day", dayId: oldDay.id });
    }
  }
  for (const day of normalizedNext.days) {
    const oldDay = normalizedPrevious.days.find((candidate) => candidate.id === day.id);
    if (!oldDay || !sameJson(oldDay, day)) operations.push({ op: "upsert_day", day });
  }

  const fields = changedTripFields(normalizedPrevious, normalizedNext);
  if (Object.keys(fields).length > 0) operations.unshift({ op: "update_trip", fields });

  return { operations };
}

function normalizeTrip(trip: TripState): TripState {
  const parsed = TripStateSchema.parse(trip);
  assertUnique(
    parsed.days.map((day) => day.id),
    "TripDay id",
  );
  assertUnique(
    parsed.days.map((day) => String(day.dayNumber)),
    "TripDay dayNumber",
  );
  for (const day of parsed.days) {
    assertUnique(
      day.blocks.map((block) => block.id),
      `TripBlock id in ${day.id}`,
    );
  }
  return {
    ...parsed,
    days: parsed.days
      .map((day) => ({ ...day, blocks: [...day.blocks] }))
      .sort((a, b) => a.dayNumber - b.dayNumber),
  };
}

function cloneTrip(trip: TripState): TripState {
  return normalizeTrip(JSON.parse(JSON.stringify(trip)) as TripState);
}

function requireTrip(trip: TripState | null, op: string): TripState {
  if (!trip) throw new Error(`${op} requires an existing trip`);
  return trip;
}

function upsertDay(trip: TripState, day: TripDay): TripState {
  return normalizeTrip({ ...trip, days: upsertById(trip.days, TripDaySchema.parse(day)) });
}

function updateDay(
  trip: TripState,
  operation: Extract<TripPatchOperation, { op: "update_day" }>,
): TripState {
  const index = findDayIndex(trip, operation);
  const existing = trip.days[index];
  if (!existing) throw new Error("TripDay not found");
  return normalizeTrip({
    ...trip,
    days: replaceAt(
      trip.days,
      index,
      TripDaySchema.parse(withDefinedFields(existing, operation.fields)),
    ),
  });
}

function deleteDay(
  trip: TripState,
  operation: Extract<TripPatchOperation, { op: "delete_day" }>,
): TripState {
  return normalizeTrip({
    ...trip,
    days: trip.days.filter((day) => !matchesDay(day, operation)),
  });
}

function updateDayBlocks(
  trip: TripState,
  operation: DaySelector,
  update: (blocks: TripBlock[]) => TripBlock[],
): TripState {
  const index = findDayIndex(trip, operation);
  const day = trip.days[index];
  if (!day) throw new Error("TripDay not found");
  return normalizeTrip({
    ...trip,
    days: replaceAt(trip.days, index, { ...day, blocks: update(day.blocks) }),
  });
}

function findDayIndex(trip: TripState, operation: DaySelector): number {
  const index = trip.days.findIndex((day) => matchesDay(day, operation));
  if (index < 0) throw new Error("TripDay not found");
  return index;
}

type DaySelector = {
  dayId?: string | undefined;
  dayNumber?: number | undefined;
};

function matchesDay(day: TripDay, operation: DaySelector): boolean {
  if (!operation.dayId && !operation.dayNumber) {
    throw new Error("A dayId or dayNumber is required");
  }
  return day.id === operation.dayId || day.dayNumber === operation.dayNumber;
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((candidate) => candidate.id === item.id);
  return index < 0 ? [...items, item] : replaceAt(items, index, item);
}

function withDefinedFields<T extends object>(
  base: T,
  fields: Partial<Record<keyof T, unknown>>,
): T {
  return Object.fromEntries(
    Object.entries({ ...base, ...fields }).filter(([, value]) => value !== undefined),
  ) as T;
}

function replaceAt<T>(items: T[], index: number, item: T): T[] {
  return items.map((candidate, candidateIndex) => (candidateIndex === index ? item : candidate));
}

function changedTripFields(
  previous: TripState,
  next: TripState,
): z.infer<typeof TripStateFieldsSchema> {
  const fields: z.infer<typeof TripStateFieldsSchema> = {};
  for (const key of [
    "title",
    "destinationCountry",
    "startDate",
    "endDate",
    "travelers",
    "updatedAt",
  ] as const) {
    if (!sameJson(previous[key], next[key])) {
      Object.assign(fields, { [key]: next[key] });
    }
  }
  return fields;
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`Duplicate ${label}`);
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
