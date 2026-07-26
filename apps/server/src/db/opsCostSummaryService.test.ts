import { describe, expect, it } from "vitest";
import type { Db } from "./client.js";
import { createDbOpsCostSummaryService } from "./opsCostSummaryService.js";

const admin = {
  userId: "b9556925-ddeb-4b26-9422-f14f28e51c67",
  role: "admin" as const,
  permissions: ["cost.read" as const],
};

describe("createDbOpsCostSummaryService", () => {
  it("maps private views without returning raw identity or reconciliation run ids", async () => {
    const rawIdentity = "f2277547-7d35-4ecf-9889-c2091ef6a5c5";
    const results = [
      [
        {
          day: "2026-07-26",
          call_count: "2",
          input_tokens: "120",
          cached_input_tokens: "20",
          output_tokens: "40",
          cost_usd: "0.01000000",
          fallback_rate: "0.5",
          cache_hit_rate: "0.16666667",
        },
      ],
      [
        {
          provider: "moonshot",
          model: "kimi-k2.6",
          effort: "medium",
          call_count: "2",
          input_tokens: "120",
          cached_input_tokens: "20",
          output_tokens: "40",
          cost_usd: "0.01000000",
          fallback_rate: "0.5",
          cache_hit_rate: "0.16666667",
        },
      ],
      [
        {
          identity_kind: "authenticated",
          identity_id: rawIdentity,
          call_count: "2",
          input_tokens: "120",
          cached_input_tokens: "20",
          output_tokens: "40",
          cost_usd: "0.01000000",
          fallback_rate: "0.5",
          cache_hit_rate: "0.16666667",
        },
      ],
      [{ unpriced_call_count: "1", affected_model_count: "1", oldest_unpriced_at: null }],
    ];
    let call = 0;
    const db = {
      execute: async () => results[call++] ?? [],
    } as unknown as Db;
    const summary = await createDbOpsCostSummaryService(db, {
      now: () => new Date("2026-07-26T12:00:00.000Z"),
    }).getSummary(admin);

    expect(summary.daily[0]?.costUsd).toBe("0.01000000");
    expect(summary.byModel[0]).toMatchObject({ provider: "moonshot", model: "kimi-k2.6" });
    expect(summary.topIdentities[0]?.identityRef).toMatch(/^user-[a-f0-9]{12}$/);
    expect(JSON.stringify(summary)).not.toContain(rawIdentity);
    expect(JSON.stringify(summary)).not.toContain("agent_run_id");
    expect(summary.reconciliation).toEqual({
      unpricedCallCount: 1,
      affectedModelCount: 1,
      oldestUnpricedAt: null,
    });
  });

  it("rejects a non-admin before querying private views even if permission data is malformed", async () => {
    let queried = false;
    const db = {
      execute: async () => {
        queried = true;
        return [];
      },
    } as unknown as Db;

    await expect(
      createDbOpsCostSummaryService(db).getSummary({
        userId: crypto.randomUUID(),
        role: "operator",
        permissions: ["cost.read"],
      }),
    ).rejects.toThrow("Forbidden Ops permission.");
    expect(queried).toBe(false);
  });
});
