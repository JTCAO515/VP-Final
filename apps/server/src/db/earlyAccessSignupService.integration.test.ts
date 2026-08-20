import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbEarlyAccessSignupService } from "./earlyAccessSignupService.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const firstEmail = "early-access-db-first@example.com";
const secondEmail = "early-access-db-second@example.com";

describeDatabase("database EarlyAccessSignupService", () => {
  const sql = postgres(databaseUrl!);
  const service = createDbEarlyAccessSignupService(drizzle(sql, { schema }), {
    now: () => new Date("2026-08-20T00:00:00.000Z"),
  });

  beforeEach(async () => {
    await sql`delete from public.early_access_signups where email in (${firstEmail}, ${secondEmail})`;
  });

  afterAll(async () => {
    await sql`delete from public.early_access_signups where email in (${firstEmail}, ${secondEmail})`;
    await sql.end();
  });

  it("writes one normalized row with only a digest and bounded metadata", async () => {
    const metadata = {
      ipHash: "a".repeat(64),
      userAgent: "VisePanda test agent",
    };

    await expect(
      service.submit(
        {
          email: " EARLY-ACCESS-DB-FIRST@EXAMPLE.COM ",
          locale: "en",
          source: "landing",
          primaryConcern: "payment_and_cash",
        },
        metadata,
      ),
    ).resolves.toEqual({ status: "subscribed" });
    await expect(
      service.submit(
        {
          email: firstEmail,
          locale: "en",
          source: "landing",
          primaryConcern: "language_and_communication",
        },
        metadata,
      ),
    ).resolves.toEqual({ status: "already_subscribed" });

    const [row] = await sql`
      select email, primary_concern, ip_hash, user_agent, retention_expires_at
      from public.early_access_signups
      where email = ${firstEmail}
    `;
    if (!row) throw new Error("Expected a durable Early Access signup row.");
    expect(row).toMatchObject({
      email: firstEmail,
      primary_concern: "payment_and_cash",
      ip_hash: "a".repeat(64),
      user_agent: "VisePanda test agent",
    });
    expect(new Date(row.retention_expires_at).toISOString()).toBe("2027-08-20T00:00:00.000Z");
  });
});
