import { sql } from "drizzle-orm";
import type { Db } from "./client.js";
import {
  costWindow,
  privateIdentityReference,
  requireCostRead,
  type CopilotCostDailySummary,
  type CopilotCostIdentitySummary,
  type CopilotCostModelSummary,
  type OpsCostSummaryService,
} from "../modules/costSummary/service.js";

type DailyRow = {
  day: string;
  call_count: string | number;
  input_tokens: string | number;
  cached_input_tokens: string | number;
  output_tokens: string | number;
  cost_usd: string;
  fallback_rate: string;
  cache_hit_rate: string;
};

type ModelRow = Omit<DailyRow, "day"> & {
  provider: string;
  model: string;
  effort: string;
};

type IdentityRow = Omit<DailyRow, "day"> & {
  identity_kind: "authenticated" | "anonymous";
  identity_id: string;
};

type ReconciliationRow = {
  unpriced_call_count: string | number;
  affected_model_count: string | number;
  oldest_unpriced_at: Date | string | null;
};

export function createDbOpsCostSummaryService(
  db: Db,
  options: { now?: () => Date } = {},
): OpsCostSummaryService {
  const now = options.now ?? (() => new Date());
  return {
    async getSummary(actor, query = {}) {
      requireCostRead(actor);
      const window = costWindow(now(), query.windowDays);
      const fromDay = new Date(`${window.fromDay}T00:00:00.000Z`);
      const throughExclusive = new Date(`${window.throughDay}T00:00:00.000Z`);
      throughExclusive.setUTCDate(throughExclusive.getUTCDate() + 1);

      const [dailyRows, modelRows, identityRows, reconciliationRows] = await Promise.all([
        db.execute<DailyRow>(sql`
          select day::text, call_count, input_tokens, cached_input_tokens, output_tokens,
                 cost_usd::text, fallback_rate::text, cache_hit_rate::text
          from internal.copilot_cost_daily
          where day >= ${window.fromDay}::date and day <= ${window.throughDay}::date
          order by day desc
        `),
        db.execute<ModelRow>(sql`
          select provider, model, effort,
                 sum(call_count)::bigint as call_count,
                 sum(input_tokens)::bigint as input_tokens,
                 sum(cached_input_tokens)::bigint as cached_input_tokens,
                 sum(output_tokens)::bigint as output_tokens,
                 sum(cost_usd)::text as cost_usd,
                 coalesce(sum(call_count * fallback_rate) / nullif(sum(call_count), 0), 0)::text
                   as fallback_rate,
                 coalesce(sum(cached_input_tokens)::numeric / nullif(sum(input_tokens), 0), 0)::text
                   as cache_hit_rate
          from internal.copilot_cost_by_model_daily
          where day >= ${window.fromDay}::date and day <= ${window.throughDay}::date
          group by provider, model, effort
          order by sum(cost_usd) desc, provider, model, effort
        `),
        db.execute<IdentityRow>(sql`
          select identity_kind, identity_id,
                 sum(call_count)::bigint as call_count,
                 sum(input_tokens)::bigint as input_tokens,
                 sum(cached_input_tokens)::bigint as cached_input_tokens,
                 sum(output_tokens)::bigint as output_tokens,
                 sum(cost_usd)::text as cost_usd,
                 coalesce(sum(call_count * fallback_rate) / nullif(sum(call_count), 0), 0)::text
                   as fallback_rate,
                 coalesce(sum(cached_input_tokens)::numeric / nullif(sum(input_tokens), 0), 0)::text
                   as cache_hit_rate
          from internal.copilot_cost_by_identity_daily
          where day >= ${window.fromDay}::date and day <= ${window.throughDay}::date
          group by identity_kind, identity_id
          order by sum(cost_usd) desc, identity_kind, identity_id
          limit 10
        `),
        db.execute<ReconciliationRow>(sql`
          select count(*)::bigint as unpriced_call_count,
                 count(distinct (provider, model))::bigint as affected_model_count,
                 min(created_at) as oldest_unpriced_at
          from internal.copilot_cost_reconciliation_health
          where created_at >= ${fromDay} and created_at < ${throughExclusive}
        `),
      ]);

      const reconciliation = reconciliationRows[0];
      return {
        ...window,
        daily: dailyRows.map(dailySummary),
        byModel: modelRows.map(modelSummary),
        topIdentities: identityRows.map(identitySummary),
        reconciliation: {
          unpricedCallCount: count(reconciliation?.unpriced_call_count ?? 0),
          affectedModelCount: count(reconciliation?.affected_model_count ?? 0),
          oldestUnpricedAt: isoDate(reconciliation?.oldest_unpriced_at ?? null),
        },
      };
    },
  };
}

function dailySummary(row: DailyRow): CopilotCostDailySummary {
  return {
    day: row.day,
    ...aggregateSummary(row),
  };
}

function aggregateSummary(row: Omit<DailyRow, "day">): Omit<CopilotCostDailySummary, "day"> {
  return {
    callCount: count(row.call_count),
    inputTokens: count(row.input_tokens),
    cachedInputTokens: count(row.cached_input_tokens),
    outputTokens: count(row.output_tokens),
    costUsd: row.cost_usd,
    fallbackRate: row.fallback_rate,
    cacheHitRate: row.cache_hit_rate,
  };
}

function modelSummary(row: ModelRow): CopilotCostModelSummary {
  const { provider, model, effort, ...aggregate } = row;
  return { provider, model, effort, ...aggregateSummary(aggregate) };
}

function identitySummary(row: IdentityRow): CopilotCostIdentitySummary {
  const { identity_kind: identityKind, identity_id: identityId, ...aggregate } = row;
  return {
    identityKind,
    identityRef: privateIdentityReference(identityKind, identityId),
    ...aggregateSummary(aggregate),
  };
}

function count(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Invalid cost aggregate count.");
  return parsed;
}

function isoDate(value: Date | string | null): string | null {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("Invalid reconciliation timestamp.");
  return parsed.toISOString();
}
