import { and, gt, gte, lt, sql } from "drizzle-orm";
import type { TripIdentity } from "../modules/trip/versionedService.js";
import {
  isDailyLlmBudgetExceeded,
  normalizeUsd,
  prepareDailyBudgetExceededEvent,
  utcBudgetDay,
} from "../modules/observability/dailyBudget.js";
import type { Db } from "./client.js";
import { llmCallCosts, telemetryEvents } from "./schema.js";

export type DailyBudgetObservationResult =
  | { status: "within_budget"; observedCostUsd: string }
  | { status: "recorded"; observedCostUsd: string }
  | { status: "already_recorded"; observedCostUsd: string };

export async function observeDailyLlmBudget(input: {
  db: Db;
  identity: TripIdentity;
  budgetUsd: string;
  createdAt: Date;
  retentionDays: number;
}): Promise<DailyBudgetObservationResult> {
  const budgetDay = utcBudgetDay(input.createdAt);
  const [summary] = await input.db
    .select({
      costUsd: sql<string>`coalesce(sum(${llmCallCosts.costUsd}), 0)::text`,
    })
    .from(llmCallCosts)
    .where(
      and(
        gte(llmCallCosts.createdAt, budgetDay.start),
        lt(llmCallCosts.createdAt, budgetDay.end),
        gt(llmCallCosts.retentionExpiresAt, input.createdAt),
      ),
    );
  const observedCostUsd = normalizeUsd(summary?.costUsd ?? "0");

  if (!isDailyLlmBudgetExceeded(observedCostUsd, input.budgetUsd)) {
    return { status: "within_budget", observedCostUsd };
  }

  const event = prepareDailyBudgetExceededEvent({
    identity: input.identity,
    budgetUsd: input.budgetUsd,
    observedCostUsd,
    createdAt: input.createdAt,
    retentionDays: input.retentionDays,
  });
  const inserted = await input.db
    .insert(telemetryEvents)
    .values({
      id: event.id,
      userId: event.user_id ?? null,
      anonId: event.anon_id ?? null,
      surface: event.surface,
      action: event.action,
      entityType: event.entity_type,
      entityId: event.entity_id ?? null,
      intent: event.intent ?? null,
      partner: event.partner ?? null,
      clickId: event.click_id ?? null,
      propsJsonb: event.props_jsonb,
      retentionExpiresAt: new Date(event.retention_expires_at),
      createdAt: new Date(event.created_at),
    })
    .onConflictDoNothing()
    .returning({ id: telemetryEvents.id });

  return {
    status: inserted.length === 0 ? "already_recorded" : "recorded",
    observedCostUsd,
  };
}
