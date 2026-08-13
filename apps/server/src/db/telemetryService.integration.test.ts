import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { createDb } from "./client.js";
import { telemetryEvents, users } from "./schema.js";
import { createDbTelemetryService } from "./telemetryService.js";

const databaseUrl = process.env.DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
const eventIds = [
  "00000000-0000-4000-8000-000000000211",
  "00000000-0000-4000-8000-000000000212",
  "00000000-0000-4000-8000-000000000214",
];
const userId = "00000000-0000-4000-8000-000000000213";

integration("DbTelemetryService", () => {
  const db = databaseUrl ? createDb(databaseUrl) : null!;

  beforeAll(async () => {
    await cleanup();
    await db.execute(sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        ${userId}, 'authenticated', 'authenticated', 'telemetry-test@example.com', '',
        '{}'::jsonb, '{}'::jsonb, now(), now()
      )
    `);
  });

  afterAll(cleanup);

  it("persists a validated anonymous event with the configured retention deadline", async () => {
    const service = createDbTelemetryService(db, {
      now: () => new Date("2026-07-27T12:00:00.000Z"),
      randomId: () => eventIds[0]!,
    });

    await service.track({
      anon_id: "a".repeat(43),
      surface: "web",
      action: "guide_viewed",
      entity_type: "guide",
      entity_id: "payment-guide",
      props_jsonb: { city: "Shanghai" },
    });

    const [row] = await db
      .select()
      .from(telemetryEvents)
      .where(eq(telemetryEvents.id, eventIds[0]!));
    expect(row).toMatchObject({
      userId: null,
      anonId: "a".repeat(43),
      action: "guide_viewed",
      entityId: "payment-guide",
      propsJsonb: { city: "Shanghai" },
      retentionExpiresAt: new Date("2027-01-23T12:00:00.000Z"),
    });
  });

  it("persists only the verified authenticated identity and creates no sensitive payload", async () => {
    const service = createDbTelemetryService(db, {
      now: () => new Date("2026-07-27T12:00:00.000Z"),
      randomId: () => eventIds[1]!,
    });

    await service.track({
      user_id: userId,
      surface: "web",
      action: "poi_viewed",
      entity_type: "poi",
      entity_id: "shanghai.yu-garden",
      props_jsonb: { city: "Shanghai", category: "Attraction" },
    });

    const [row] = await db
      .select()
      .from(telemetryEvents)
      .where(eq(telemetryEvents.id, eventIds[1]!));
    expect(row).toMatchObject({ userId, anonId: null });
    expect(JSON.stringify(row)).not.toMatch(
      /api[_-]?key|authorization|contact|cookie|description|message|password|prompt|signature|secret/i,
    );
  });

  it("rejects unregistered properties before opening a database write", async () => {
    const service = createDbTelemetryService(db);

    await expect(
      service.track({
        anon_id: "a".repeat(43),
        surface: "web",
        action: "human_help_viewed",
        entity_type: "human_help",
        props_jsonb: { contact: "traveler@example.com" },
      }),
    ).rejects.toThrow();
  });

  it("treats a repeated mobile event id as one durable observation", async () => {
    const service = createDbTelemetryService(db, {
      now: () => new Date("2026-08-14T12:00:00.000Z"),
      randomId: () => eventIds[2]!,
    });
    const input = {
      user_id: userId,
      surface: "mobile" as const,
      action: "tool_opened" as const,
      entity_type: "tool",
      entity_id: "translation",
      props_jsonb: { tool: "translation" },
    };

    await service.track(input);
    await service.track(input);

    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(telemetryEvents)
      .where(eq(telemetryEvents.id, eventIds[2]!));
    expect(row?.count).toBe(1);
  });

  async function cleanup() {
    await db.delete(telemetryEvents).where(inArray(telemetryEvents.id, eventIds));
    await db.delete(users).where(eq(users.id, userId));
    await db.execute(sql`delete from auth.users where id = ${userId}`);
  }
});
