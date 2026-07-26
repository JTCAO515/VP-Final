import { createHash } from "node:crypto";
import type { OpsAccess } from "../opsAuthorization/service.js";

export type CopilotCostDailySummary = {
  day: string;
  callCount: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  costUsd: string;
  fallbackRate: string;
  cacheHitRate: string;
};

export type CopilotCostModelSummary = Omit<CopilotCostDailySummary, "day"> & {
  provider: string;
  model: string;
  effort: string;
};

export type CopilotCostIdentitySummary = Omit<CopilotCostDailySummary, "day"> & {
  identityKind: "authenticated" | "anonymous";
  identityRef: string;
};

export type CopilotCostReconciliationSummary = {
  unpricedCallCount: number;
  affectedModelCount: number;
  oldestUnpricedAt: string | null;
};

export type CopilotCostSummary = {
  fromDay: string;
  throughDay: string;
  daily: CopilotCostDailySummary[];
  byModel: CopilotCostModelSummary[];
  topIdentities: CopilotCostIdentitySummary[];
  reconciliation: CopilotCostReconciliationSummary;
};

export type OpsCostSummaryService = {
  getSummary(actor: OpsAccess, options?: { windowDays?: number }): Promise<CopilotCostSummary>;
};

export function requireCostRead(actor: OpsAccess): void {
  if (actor.role !== "admin" || !actor.permissions.includes("cost.read")) {
    throw new Error("Forbidden Ops permission.");
  }
}

export function costWindow(now: Date, windowDays = 14): { fromDay: string; throughDay: string } {
  if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 90) {
    throw new Error("Cost summary window must be an integer between 1 and 90 days.");
  }
  if (!Number.isFinite(now.getTime())) throw new Error("Cost summary date is invalid.");
  const throughDay = now.toISOString().slice(0, 10);
  const from = new Date(`${throughDay}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - (windowDays - 1));
  return { fromDay: from.toISOString().slice(0, 10), throughDay };
}

export function privateIdentityReference(
  identityKind: "authenticated" | "anonymous",
  identityId: string,
): string {
  const digest = createHash("sha256").update(identityId).digest("hex").slice(0, 12);
  return `${identityKind === "authenticated" ? "user" : "anon"}-${digest}`;
}
