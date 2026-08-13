import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbVisePodUserResolutionService } from "./visePodUserResolutionService.js";
import { createInMemoryOpsAuthorizationService } from "../modules/opsAuthorization/service.js";
import { createInMemoryVisePodProvisioningService } from "../modules/visepod/provisioning.js";
import { createInMemoryVisePodStudioUserLookupRateLimiter } from "../modules/visepod/userLookupLimiter.js";
import {
  VisePodUserLookupNotFoundError,
  VisePodUserLookupRateLimitedError,
} from "../modules/visepod/userResolution.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const adminId = "34000000-0000-4000-8000-000000000001";
const travelerId = "34000000-0000-4000-8000-000000000002";
const email = "issue340-traveler@example.test";
const baseAt = new Date("2026-08-13T01:00:00.000Z");

describeDatabase("database VisePod exact user resolution", () => {
  const sql = postgres(databaseUrl!);
  const authorization = createInMemoryOpsAuthorizationService([{ userId: adminId, role: "admin" }]);
  const provisioning = createInMemoryVisePodProvisioningService(authorization, () => baseAt);
  const limiter = createInMemoryVisePodStudioUserLookupRateLimiter({ minuteLimit: 10 });
  const service = createDbVisePodUserResolutionService(
    drizzle(sql, { schema }),
    provisioning,
    limiter,
    () => baseAt,
  );

  beforeEach(async () => {
    await sql`delete from public.ops_audit_events where action = 'visepod.user.resolve'`;
    await sql`delete from public.users where id = ${travelerId}`;
    await sql`delete from auth.users where id in (${adminId}, ${travelerId})`;
    await sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values
        (${adminId}, 'authenticated', 'authenticated', 'issue340-admin@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
        (${travelerId}, 'authenticated', 'authenticated', ${email}, '', '{}'::jsonb, '{}'::jsonb, now(), now())
    `;
    await sql`insert into public.users (id, email) values (${travelerId}, ${email})`;
  });

  afterAll(async () => {
    await sql`delete from public.ops_audit_events where action = 'visepod.user.resolve'`;
    await sql`delete from public.users where id = ${travelerId}`;
    await sql`delete from auth.users where id in (${adminId}, ${travelerId})`;
    await sql.end();
  });

  async function token() {
    return (await provisioning.issue((await authorization.getAccess(adminId))!, "development"))
      .token;
  }

  it("resolves one exact user, returns no raw email, and writes a one-way audit record", async () => {
    const resolved = await service.resolve({
      token: await token(),
      environment: "development",
      request: { email },
    });
    expect(resolved).toEqual({
      userId: travelerId,
      displayName: null,
      emailHint: "i***@example.test",
    });
    expect(JSON.stringify(resolved)).not.toContain(email);
    const audits = await sql`
      select action, target_id, metadata_jsonb from public.ops_audit_events
      where action = 'visepod.user.resolve'
    `;
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits[0])).not.toContain(email);
    expect(audits[0]?.target_id).toMatch(/^[a-f0-9]{64}$/);
    expect(audits[0]?.metadata_jsonb).toMatchObject({ identifierKind: "email", result: "found" });
  });

  it("does not broaden a valid but non-exact identifier and audits a miss without raw identity", async () => {
    const issued = await token();
    await expect(
      service.resolve({
        token: issued,
        environment: "development",
        request: { email: "issue340-traveler-prefix@example.test" },
      }),
    ).rejects.toBeInstanceOf(VisePodUserLookupNotFoundError);
    await expect(
      service.resolve({
        token: issued,
        environment: "development",
        request: { email: "issue340-traveler@example.testx" },
      }),
    ).rejects.toBeInstanceOf(VisePodUserLookupNotFoundError);
    const audits = await sql`
      select target_id, metadata_jsonb from public.ops_audit_events where action = 'visepod.user.resolve'
    `;
    expect(audits).toHaveLength(2);
    expect(JSON.stringify(audits)).not.toContain("issue340-traveler");
    expect(audits.map((audit) => audit.metadata_jsonb)).toEqual(
      expect.arrayContaining([expect.objectContaining({ result: "not_found" })]),
    );
  });

  it("checks the grant before user access and rate-limits before another lookup", async () => {
    const limited = createDbVisePodUserResolutionService(
      drizzle(sql, { schema }),
      provisioning,
      createInMemoryVisePodStudioUserLookupRateLimiter({ minuteLimit: 1 }),
      () => baseAt,
    );
    await expect(
      limited.resolve({
        token: "not-a-valid-provisioning-token",
        environment: "development",
        request: { email },
      }),
    ).rejects.toThrow("provisioning access");
    await expect(
      limited.resolve({
        token: await token(),
        environment: "development",
        request: { userId: travelerId },
      }),
    ).resolves.toMatchObject({ userId: travelerId });
    await expect(
      limited.resolve({
        token: await token(),
        environment: "development",
        request: { userId: travelerId },
      }),
    ).rejects.toBeInstanceOf(VisePodUserLookupRateLimitedError);
  });
});
