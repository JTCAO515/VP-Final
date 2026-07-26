import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { createDb } from "./client.js";
import { createDbCommerceService } from "./commerceService.js";
import { outboundClicks, partners, users } from "./schema.js";
import { createInMemoryTelemetryService } from "../modules/telemetry/service.js";

const databaseUrl = process.env.DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
const partnerKeys = ["test-active", "test-pending", "test-inactive"];
const anonymousId = "a".repeat(43);
const authenticatedUserId = "00000000-0000-4000-8000-000000000301";
const clickIds = ["00000000-0000-4000-8000-000000000311", "00000000-0000-4000-8000-000000000312"];

integration("DbCommerceService", () => {
  const db = databaseUrl ? createDb(databaseUrl) : null!;

  beforeAll(async () => {
    await cleanup();
    await db.execute(sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        ${authenticatedUserId}, 'authenticated', 'authenticated', 'traveler@example.com', '',
        '{}'::jsonb, '{}'::jsonb, now(), now()
      )
    `);
    await db
      .insert(partners)
      .values([
        partner("test-active", "active"),
        partner("test-pending", "pending"),
        partner("test-inactive", "inactive"),
      ]);
  });

  afterAll(cleanup);

  it("atomically records an anonymous click before returning the active-partner redirect", async () => {
    const telemetry = createInMemoryTelemetryService();
    const service = createDbCommerceService(db, {
      telemetryService: telemetry,
      now: () => new Date("2026-07-26T02:00:00.000Z"),
      randomId: () => clickIds[0]!,
    });

    const result = await service.createOutboundRedirect({
      identity: { kind: "anonymous", anonId: anonymousId },
      partnerKey: "test-active",
      targetUrl: "https://partner.example/hotel?campaign=summer",
      source: "explore",
      intent: "commerce_intent",
      entityId: "poi-123",
    });
    const [row] = await db.select().from(outboundClicks).where(eq(outboundClicks.id, clickIds[0]!));

    expect(result.redirectUrl).toBe(
      `https://partner.example/hotel?campaign=summer&vp_click_id=${clickIds[0]}`,
    );
    expect(row).toMatchObject({
      id: clickIds[0],
      partner: "test-active",
      userId: null,
      anonId: anonymousId,
      source: "explore",
      intent: "commerce_intent",
      entityId: "poi-123",
    });
    await expect(telemetry.list()).resolves.toHaveLength(1);
    expect(JSON.stringify(row)).not.toMatch(/api[_-]?key|cookie|signature|authorization|email/i);
  });

  it("records only the verified user identity for an authenticated request", async () => {
    const service = createDbCommerceService(db, {
      randomId: () => clickIds[1]!,
    });

    await service.createOutboundRedirect({
      identity: {
        kind: "authenticated",
        userId: authenticatedUserId,
        email: "traveler@example.com",
        anonId: "b".repeat(43),
      },
      partnerKey: "test-active",
      targetUrl: "https://partner.example/experience",
    });
    const [row] = await db.select().from(outboundClicks).where(eq(outboundClicks.id, clickIds[1]!));

    expect(row).toMatchObject({ userId: authenticatedUserId, anonId: null });
  });

  it.each(["test-pending", "test-inactive", "missing-partner"])(
    "does not create a click for unavailable partner %s",
    async (partnerKey) => {
      const service = createDbCommerceService(db);
      const before = await countPartnerClicks(partnerKey);

      await expect(
        service.createOutboundRedirect({
          identity: { kind: "anonymous", anonId: anonymousId },
          partnerKey,
          targetUrl: "https://partner.example/hotel",
        }),
      ).rejects.toMatchObject({ code: "PARTNER_UNAVAILABLE" });
      await expect(countPartnerClicks(partnerKey)).resolves.toBe(before);
    },
  );

  it("rejects a non-allowlisted target without creating a click", async () => {
    const service = createDbCommerceService(db);
    const before = await countPartnerClicks("test-active");

    await expect(
      service.createOutboundRedirect({
        identity: { kind: "anonymous", anonId: anonymousId },
        partnerKey: "test-active",
        targetUrl: "https://attacker.example/hotel",
      }),
    ).rejects.toMatchObject({ code: "INVALID_OUTBOUND_TARGET" });
    await expect(countPartnerClicks("test-active")).resolves.toBe(before);
  });

  it("keeps a durable redirect available when telemetry persistence fails", async () => {
    const onTelemetryError = vi.fn();
    const service = createDbCommerceService(db, {
      randomId: () => crypto.randomUUID(),
      telemetryService: {
        track: async () => {
          throw new Error("telemetry offline");
        },
        list: async () => [],
      },
      onTelemetryError,
    });

    const result = await service.createOutboundRedirect({
      identity: { kind: "anonymous", anonId: anonymousId },
      partnerKey: "test-active",
      targetUrl: "https://partner.example/hotel",
    });

    await expect(
      db.select().from(outboundClicks).where(eq(outboundClicks.id, result.click.id)),
    ).resolves.toHaveLength(1);
    expect(onTelemetryError).toHaveBeenCalledOnce();
  });

  async function countPartnerClicks(partnerKey: string): Promise<number> {
    return (await db.select().from(outboundClicks).where(eq(outboundClicks.partner, partnerKey)))
      .length;
  }

  async function cleanup() {
    await db.delete(outboundClicks).where(inArray(outboundClicks.partner, partnerKeys));
    await db.delete(partners).where(inArray(partners.key, partnerKeys));
    await db.delete(users).where(eq(users.id, authenticatedUserId));
    await db.execute(sql`delete from auth.users where id = ${authenticatedUserId}`);
  }
});

function partner(key: string, status: "pending" | "active" | "inactive") {
  return {
    key,
    hosts: ["partner.example"],
    categories: ["hotel"],
    cities: ["Shanghai"],
    trackingParam: "vp_click_id",
    status,
  };
}
