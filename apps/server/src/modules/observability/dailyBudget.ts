import { CopilotProductEventSchema } from "@visepanda/domain";
import type { TripIdentity } from "../trip/versionedService.js";
import { identityRecord, retentionDeadline } from "./copilotPersistence.js";

const USD_SCALE = 8;
const USD_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,8}))?$/;

export type UtcBudgetDay = {
  day: string;
  start: Date;
  end: Date;
};

export function resolveDailyLlmBudgetUsd(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const value = environment.VISEPANDA_DAILY_LLM_BUDGET_USD?.trim();
  if (!value) return null;
  const normalized = normalizeUsd(value);
  if (parseFixedUsd(normalized) <= 0n) {
    throw new Error("VISEPANDA_DAILY_LLM_BUDGET_USD must be a positive fixed-point USD amount");
  }
  return normalized;
}

export function normalizeUsd(value: string): string {
  const match = USD_PATTERN.exec(value.trim());
  if (!match)
    throw new Error("USD amount must be a nonnegative fixed-point value with at most 8 decimals");
  return `${match[1]}.${(match[2] ?? "").padEnd(USD_SCALE, "0")}`;
}

export function isDailyLlmBudgetExceeded(observedUsd: string, budgetUsd: string): boolean {
  return parseFixedUsd(normalizeUsd(observedUsd)) > parseFixedUsd(normalizeUsd(budgetUsd));
}

export function utcBudgetDay(createdAt: Date): UtcBudgetDay {
  if (!Number.isFinite(createdAt.getTime())) throw new Error("Budget observation date is invalid");
  const day = createdAt.toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00.000Z`);
  return {
    day,
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1_000),
  };
}

export function prepareDailyBudgetExceededEvent(input: {
  identity: TripIdentity;
  budgetUsd: string;
  observedCostUsd: string;
  createdAt: Date;
  retentionDays: number;
}) {
  const identity = identityRecord(input.identity);
  const budgetDay = utcBudgetDay(input.createdAt);
  return CopilotProductEventSchema.parse({
    id: crypto.randomUUID(),
    user_id: identity.user_id ?? undefined,
    anon_id: identity.anon_id ?? undefined,
    surface: "server",
    action: "daily_budget_exceeded",
    entity_type: "llm_daily_budget",
    entity_id: budgetDay.day,
    props_jsonb: {
      budgetUsd: normalizeUsd(input.budgetUsd),
      observedCostUsd: normalizeUsd(input.observedCostUsd),
    },
    created_at: input.createdAt.toISOString(),
    retention_expires_at: retentionDeadline(input.createdAt, input.retentionDays).toISOString(),
  });
}

function parseFixedUsd(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(`${whole}${fraction.padEnd(USD_SCALE, "0")}`);
}
