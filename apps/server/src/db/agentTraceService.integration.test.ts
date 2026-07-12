import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbAgentTraceService } from "./agentTraceService.js";
import { createDbVersionedTripService } from "./versionedTripService.js";
import { createCopilotPipeline } from "../modules/copilot/service.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const userId = "40000000-0000-4000-8000-000000000001";

describeDatabase("database AgentTraceService", () => {
  const sql = postgres(databaseUrl!);
  const service = createDbAgentTraceService(drizzle(sql, { schema }));

  beforeEach(async () => {
    await sql`delete from public.trips where anon_id like 'trace-test-%'`;
    await sql`delete from public.agent_runs where anon_id like 'trace-test-%' or user_id = ${userId}`;
    await sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        ${userId}, 'authenticated', 'authenticated', 'trace@example.com', '', '{}'::jsonb, '{}'::jsonb,
        now(), now()
      ) on conflict (id) do nothing
    `;
    await sql`insert into public.users (id, email) values (${userId}, 'trace@example.com') on conflict (id) do nothing`;
  });

  afterAll(async () => {
    await sql`delete from public.trips where anon_id like 'trace-test-%'`;
    await sql`delete from public.agent_runs where anon_id like 'trace-test-%' or user_id = ${userId}`;
    await sql`delete from public.users where id = ${userId}`;
    await sql`delete from auth.users where id = ${userId}`;
    await sql.end();
  });

  it("persists safe metadata for anonymous and authenticated runs", async () => {
    const anonymousRunId = crypto.randomUUID();
    const authenticatedRunId = crypto.randomUUID();
    const systemRunId = crypto.randomUUID();
    await service.recordRun({
      id: anonymousRunId,
      identity: { kind: "anonymous", anonId: "trace-test-anon" },
      status: "succeeded",
      inputDigest: "a".repeat(64),
      outputDigest: "b".repeat(64),
      latencyMs: 120,
      attempts: [
        {
          provider: "test-provider",
          model: "test-model",
          status: "succeeded",
          inputTokens: 10,
          outputTokens: 20,
          costUsd: 0.001,
          latencyMs: 100,
        },
      ],
      toolCalls: [
        {
          toolName: "poi_lookup",
          status: "succeeded",
          inputDigest: "d".repeat(64),
          outputDigest: "e".repeat(64),
          latencyMs: 30,
        },
      ],
      validationStatus: "passed",
      repairCount: 0,
    });
    await service.recordRun({
      id: authenticatedRunId,
      identity: { kind: "authenticated", userId },
      status: "failed",
      inputDigest: "c".repeat(64),
      latencyMs: 50,
      attempts: [],
      validationStatus: "failed",
      repairCount: 1,
      failureClass: "validation_error",
    });
    await service.recordRun({
      id: systemRunId,
      status: "succeeded",
      inputDigest: "f".repeat(64),
      latencyMs: 1,
      attempts: [],
      validationStatus: "passed",
      repairCount: 0,
    });

    const rows = await sql`
      select id, user_id, anon_id, input_jsonb, output_jsonb, error, input_tokens,
             output_tokens, latency_ms, validation_status, failure_class
      from public.agent_runs
      where id in (${anonymousRunId}, ${authenticatedRunId}, ${systemRunId})
      order by case when anon_id is not null then 0 when user_id is not null then 1 else 2 end
    `;
    expect(rows).toMatchObject([
      {
        id: anonymousRunId,
        user_id: null,
        anon_id: "trace-test-anon",
        input_jsonb: {},
        output_jsonb: {},
        error: null,
        input_tokens: 10,
        output_tokens: 20,
        latency_ms: 120,
        validation_status: "passed",
      },
      {
        id: authenticatedRunId,
        user_id: userId,
        anon_id: null,
        input_jsonb: {},
        output_jsonb: {},
        error: null,
        failure_class: "validation_error",
      },
      {
        id: systemRunId,
        user_id: null,
        anon_id: null,
        input_jsonb: {},
        output_jsonb: {},
        error: null,
      },
    ]);
    await expect(
      sql`select tool_name, input_jsonb, output_jsonb, error, latency_ms from public.tool_calls where agent_run_id = ${anonymousRunId}`,
    ).resolves.toMatchObject([
      { tool_name: "poi_lookup", input_jsonb: {}, output_jsonb: {}, error: null, latency_ms: 30 },
    ]);
  });

  it("records a Copilot result without changing its Trip write path", async () => {
    const identity = { kind: "anonymous" as const, anonId: "trace-test-copilot" };
    const tripService = createDbVersionedTripService(drizzle(sql, { schema }));
    const pipeline = createCopilotPipeline({ tripService, traceService: service });

    const result = await pipeline.run({ message: "Plan a 2 day Shanghai trip" }, identity);
    expect(result.trip?.id).toBeTruthy();
    const rows = await sql`
      select trip_id, anon_id, input_jsonb, output_jsonb, error, validation_status
      from public.agent_runs
      where anon_id = ${identity.anonId}
    `;
    expect(rows).toMatchObject([
      {
        trip_id: result.trip?.id,
        anon_id: identity.anonId,
        input_jsonb: {},
        output_jsonb: {},
        error: null,
        validation_status: "passed",
      },
    ]);
    if (result.trip) await sql`delete from public.trips where id = ${result.trip.id}`;
  });
});
