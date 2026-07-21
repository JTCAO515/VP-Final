import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbAgentTraceService } from "./agentTraceService.js";
import { createDbVersionedTripService } from "./versionedTripService.js";
import { createCopilotPipeline } from "../modules/copilot/service.js";
import type { AgentAttemptTrace } from "../modules/trace/service.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const userId = "40000000-0000-4000-8000-000000000001";

describeDatabase("database AgentTraceService", () => {
  const sql = postgres(databaseUrl!);
  const service = createDbAgentTraceService(drizzle(sql, { schema }));

  beforeEach(async () => {
    await sql`delete from public.trips where anon_id like 'trace-test-%'`;
    await sql`delete from public.events where anon_id like 'trace-test-%'`;
    await sql`delete from public.copilot_conversation_turns where anon_id like 'trace-test-%'`;
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
    await sql`delete from public.events where anon_id like 'trace-test-%'`;
    await sql`delete from public.copilot_conversation_turns where anon_id like 'trace-test-%'`;
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
          authorization: "Bearer must-never-persist",
        } as unknown as AgentAttemptTrace,
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
             output_tokens, attempts_jsonb, latency_ms, validation_status, failure_class
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
    expect(JSON.stringify(rows)).not.toContain("must-never-persist");
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

  it("atomically persists redacted turns, exact attempt costs, and safe product events", async () => {
    const identity = { kind: "anonymous" as const, anonId: "trace-test-observability" };
    const pipeline = createCopilotPipeline({
      tripService: createDbVersionedTripService(drizzle(sql, { schema })),
      traceService: service,
      routeIntent: () => ({
        intent: "question",
        attempts: [
          {
            provider: "deepseek",
            model: "deepseek-v4-flash",
            status: "failed",
            inputTokens: 100,
            outputTokens: 0,
            costUsd: 0,
            latencyMs: 40,
            failureClass: "timeout",
            costSnapshot: {
              provider: "deepseek",
              model: "deepseek-v4-flash",
              effort: "low",
              inputTokens: 100,
              cachedInputTokens: 25,
              outputTokens: 0,
              inputPricePerMillionUsd: "0.00000000",
              cachedInputPricePerMillionUsd: "0.00000000",
              outputPricePerMillionUsd: "0.00000000",
              costUsd: "0.00000000",
              pricingMissing: true,
              fallbackTriggered: false,
            },
          },
        ],
      }),
      generateEnvelope: () => ({
        candidate: {
          intent: "question",
          message: {
            headline: "Payment help",
            body: "Do not repeat cookie=session-secret or alex@example.com.",
            highlights: [],
          },
          tripActions: [],
          toolCards: [],
          commercialActions: [],
          humanHelp: null,
          citations: [],
        },
        attempts: [
          {
            provider: "qwen",
            model: "qwen-plus",
            status: "succeeded",
            inputTokens: 200,
            outputTokens: 50,
            costUsd: 0.00012345,
            latencyMs: 90,
            costSnapshot: {
              provider: "qwen",
              model: "qwen-plus",
              effort: "medium",
              inputTokens: 200,
              cachedInputTokens: 40,
              outputTokens: 50,
              inputPricePerMillionUsd: "0.40000000",
              cachedInputPricePerMillionUsd: "0.10000000",
              outputPricePerMillionUsd: "1.20000000",
              costUsd: "0.00012345",
              pricingMissing: false,
              fallbackTriggered: true,
            },
          },
        ],
      }),
    });

    await pipeline.run(
      {
        message:
          "Help alex@example.com with passport E12345678; signature=abc123def456; sk-secretvalue12345",
      },
      identity,
    );

    const turns = await sql`
      select status, user_message, assistant_envelope_jsonb, redaction_classes_jsonb,
             (extract(epoch from (retention_expires_at - created_at)) / 86400)::int as retention_days
      from public.copilot_conversation_turns
      where anon_id = ${identity.anonId}
    `;
    expect(turns).toMatchObject([
      {
        status: "succeeded",
        redaction_classes_jsonb: ["cookie", "credential", "email", "signature", "travel_document"],
        retention_days: 180,
      },
    ]);

    const costs = await sql`
      select attempt_index, provider, effort, status, input_tokens, cached_input_tokens,
             output_tokens, input_price_per_million_usd,
             cached_input_price_per_million_usd, output_price_per_million_usd,
             cost_usd, fallback_triggered, failure_class,
             (extract(epoch from (retention_expires_at - created_at)) / 86400)::int as retention_days
      from public.llm_call_costs
      where anon_id = ${identity.anonId}
      order by attempt_index
    `;
    expect(costs).toMatchObject([
      {
        attempt_index: 1,
        provider: "deepseek",
        effort: "low",
        status: "failed",
        input_tokens: 100,
        cached_input_tokens: 25,
        output_tokens: 0,
        cost_usd: "0.00000000",
        fallback_triggered: false,
        failure_class: "timeout",
        retention_days: 400,
      },
      {
        attempt_index: 2,
        provider: "qwen",
        effort: "medium",
        status: "succeeded",
        input_tokens: 200,
        cached_input_tokens: 40,
        output_tokens: 50,
        input_price_per_million_usd: "0.40000000",
        cached_input_price_per_million_usd: "0.10000000",
        output_price_per_million_usd: "1.20000000",
        cost_usd: "0.00012345",
        fallback_triggered: true,
        failure_class: null,
        retention_days: 400,
      },
    ]);

    const events = await sql`
      select action, props_jsonb,
             (extract(epoch from (retention_expires_at - created_at)) / 86400)::int as retention_days
      from public.events
      where anon_id = ${identity.anonId}
      order by action
    `;
    expect(events.map((event) => event.action)).toEqual([
      "cost_pricing_missing",
      "fallback_triggered",
      "session_started",
      "turn_completed",
    ]);
    expect(events.every((event) => event.retention_days === 180)).toBe(true);

    const persisted = JSON.stringify({ turns, costs, events });
    expect(persisted).not.toContain("alex@example.com");
    expect(persisted).not.toContain("E12345678");
    expect(persisted).not.toContain("session-secret");
    expect(persisted).not.toContain("abc123def456");
    expect(persisted).not.toContain("sk-secretvalue12345");
  });
});
