import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbOpsCostSummaryService } from "./opsCostSummaryService.js";
import { privateIdentityReference } from "../modules/costSummary/service.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const anonId = `cost-summary-test-${crypto.randomUUID()}`;
const agentRunIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()] as const;
const admin = {
  userId: crypto.randomUUID(),
  role: "admin" as const,
  permissions: ["cost.read" as const],
};

describeDatabase("Ops cost summary database adapter", () => {
  let client: ReturnType<typeof postgres>;
  const now = new Date();

  beforeAll(async () => {
    client = postgres(databaseUrl!, { prepare: false });
    for (const id of agentRunIds) {
      await client`
        insert into public.agent_runs
          (id, anon_id, status, input_jsonb, output_jsonb, expires_at, created_at)
        values
          (${id}, ${anonId}, 'succeeded', '{}'::jsonb, '{}'::jsonb,
           ${new Date(now.getTime() + 24 * 60 * 60 * 1_000)}, ${now})
      `;
    }

    await client`
      insert into public.llm_call_costs
        (agent_run_id, anon_id, attempt_index, provider, model, effort, status,
         input_tokens, cached_input_tokens, output_tokens,
         input_price_per_million_usd, cached_input_price_per_million_usd,
         output_price_per_million_usd, cost_usd, fallback_triggered, latency_ms,
         retention_expires_at, created_at)
      values
        (${agentRunIds[0]}, ${anonId}, 1, 'moonshot', 'kimi-k2.6', 'medium', 'succeeded',
         100, 20, 40, 1, 0.5, 2, 0.00017000, false, 1000,
         ${new Date(now.getTime() + 24 * 60 * 60 * 1_000)}, ${now}),
        (${agentRunIds[1]}, ${anonId}, 1, 'zhipu', 'glm-5.2', 'medium', 'succeeded',
         50, 0, 20, 1, 0.5, 2, 0.00009000, true, 1200,
         ${new Date(now.getTime() + 24 * 60 * 60 * 1_000)}, ${now}),
        (${agentRunIds[2]}, ${anonId}, 1, 'unregistered', 'missing-price', 'low', 'succeeded',
         10, 0, 5, 0, 0, 0, 0, false, 100,
         ${new Date(now.getTime() + 24 * 60 * 60 * 1_000)}, ${now})
    `;
  });

  afterAll(async () => {
    await client`delete from public.llm_call_costs where anon_id = ${anonId}`;
    await client`delete from public.agent_runs where anon_id = ${anonId}`;
    await client.end();
  });

  it("reads daily, model, private identity, cache, fallback, and reconciliation aggregates", async () => {
    const summary = await createDbOpsCostSummaryService(drizzle(client, { schema }), {
      now: () => now,
    }).getSummary(admin);
    const day = now.toISOString().slice(0, 10);
    const daily = summary.daily.find((row) => row.day === day);
    const identity = summary.topIdentities.find(
      (row) => row.identityRef === privateIdentityReference("anonymous", anonId),
    );

    expect(daily).toMatchObject({
      callCount: expect.any(Number),
      cachedInputTokens: expect.any(Number),
    });
    expect(summary.byModel).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "moonshot", model: "kimi-k2.6" }),
        expect.objectContaining({ provider: "zhipu", model: "glm-5.2" }),
      ]),
    );
    expect(identity?.identityRef).toMatch(/^anon-[a-f0-9]{12}$/);
    expect(JSON.stringify(summary)).not.toContain(anonId);
    expect(summary.reconciliation.unpricedCallCount).toBeGreaterThanOrEqual(1);
    expect(summary.reconciliation.affectedModelCount).toBeGreaterThanOrEqual(1);
  });
});
