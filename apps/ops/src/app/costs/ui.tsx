import type { CopilotCostSummary } from "@visepanda/app-server";
import React, { type ReactNode } from "react";

type Props = {
  summary: CopilotCostSummary;
  budgetUsd: string | null;
  budgetError: string | null;
};

export function CostSummaryView({ summary, budgetUsd, budgetError }: Props) {
  const totalCalls = summary.daily.reduce((sum, row) => sum + row.callCount, 0);
  const totalCost = sumDecimals(summary.daily.map((row) => row.costUsd));
  const totalInput = summary.daily.reduce((sum, row) => sum + row.inputTokens, 0);
  const totalCached = summary.daily.reduce((sum, row) => sum + row.cachedInputTokens, 0);
  const weightedFallback = weightedRate(summary.daily, "fallbackRate", "callCount");
  const cacheHitRate = totalInput === 0 ? 0 : totalCached / totalInput;

  return (
    <>
      <CostsHeading />
      <section className="costStatus" aria-label="Cost health">
        <CostMetric label="Retained cost" value={formatUsd(totalCost)} />
        <CostMetric label="Model attempts" value={integer(totalCalls)} />
        <CostMetric label="Cache hit rate" value={percent(cacheHitRate)} />
        <CostMetric label="Fallback rate" value={percent(weightedFallback)} />
        <CostMetric
          danger={summary.reconciliation.unpricedCallCount > 0}
          label="Unpriced calls"
          value={integer(summary.reconciliation.unpricedCallCount)}
        />
      </section>

      <section className="panel costNotice" aria-label="Daily warning status">
        <div>
          <p className="eyebrow">Daily warning</p>
          <strong>
            {budgetError ??
              (budgetUsd ? `${formatUsd(budgetUsd)} observation threshold` : "Not configured")}
          </strong>
        </div>
        <p className="muted">
          This is an operational warning only. It does not charge travelers or stop model service.
        </p>
      </section>

      <CostTableSection title={`Daily · ${summary.fromDay} to ${summary.throughDay}`}>
        <table>
          <thead>
            <tr>
              <th>UTC day</th>
              <th>Calls</th>
              <th>Tokens in / cached / out</th>
              <th>Cache hit</th>
              <th>Fallback</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {summary.daily.map((row) => (
              <tr key={row.day}>
                <td>{row.day}</td>
                <td>{integer(row.callCount)}</td>
                <td>{`${integer(row.inputTokens)} / ${integer(row.cachedInputTokens)} / ${integer(row.outputTokens)}`}</td>
                <td>{percent(row.cacheHitRate)}</td>
                <td>{percent(row.fallbackRate)}</td>
                <td>{formatUsd(row.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {summary.daily.length === 0 ? (
          <p className="empty">No retained calls in this window.</p>
        ) : null}
      </CostTableSection>

      <CostTableSection title="By provider and model">
        <table>
          <thead>
            <tr>
              <th>Provider / model</th>
              <th>Effort</th>
              <th>Calls</th>
              <th>Cache hit</th>
              <th>Fallback</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {summary.byModel.map((row) => (
              <tr key={`${row.provider}:${row.model}:${row.effort}`}>
                <td>
                  <strong>{row.model}</strong>
                  <small>{row.provider}</small>
                </td>
                <td>{row.effort}</td>
                <td>{integer(row.callCount)}</td>
                <td>{percent(row.cacheHitRate)}</td>
                <td>{percent(row.fallbackRate)}</td>
                <td>{formatUsd(row.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {summary.byModel.length === 0 ? (
          <p className="empty">No model totals in this window.</p>
        ) : null}
      </CostTableSection>

      <CostTableSection title="Top private identities">
        <table>
          <thead>
            <tr>
              <th>Private reference</th>
              <th>Kind</th>
              <th>Calls</th>
              <th>Fallback</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {summary.topIdentities.map((row) => (
              <tr key={row.identityRef}>
                <td>{row.identityRef}</td>
                <td>{row.identityKind}</td>
                <td>{integer(row.callCount)}</td>
                <td>{percent(row.fallbackRate)}</td>
                <td>{formatUsd(row.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {summary.topIdentities.length === 0 ? (
          <p className="empty">No identity totals in this window.</p>
        ) : null}
      </CostTableSection>

      <section
        className={`panel reconciliation ${summary.reconciliation.unpricedCallCount > 0 ? "needsReview" : ""}`}
      >
        <div>
          <p className="eyebrow">Reconciliation health</p>
          <h2>
            {summary.reconciliation.unpricedCallCount === 0
              ? "No unpriced retained calls"
              : `${integer(summary.reconciliation.unpricedCallCount)} ${summary.reconciliation.unpricedCallCount === 1 ? "call needs" : "calls need"} review`}
          </h2>
        </div>
        <p className="muted">
          {summary.reconciliation.unpricedCallCount === 0
            ? "Every token-bearing call in this window has at least one price snapshot."
            : `${integer(summary.reconciliation.affectedModelCount)} model configurations are affected. Oldest: ${summary.reconciliation.oldestUnpricedAt ? new Date(summary.reconciliation.oldestUnpricedAt).toISOString() : "unknown"}.`}
        </p>
      </section>
    </>
  );
}

export function CostsHeading() {
  return (
    <section className="heading costHeading">
      <div>
        <p className="eyebrow">Copilot operations</p>
        <h1>Cost summary</h1>
        <p className="muted">
          Private retained aggregates for reconciliation. Times and daily boundaries use UTC.
        </p>
      </div>
      <span className="pill">Admin only</span>
    </section>
  );
}

function CostMetric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "metric dangerMetric" : "metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CostTableSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="costSection">
      <h2>{title}</h2>
      <div className="panel tableScroll">{children}</div>
    </section>
  );
}

function integer(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function percent(value: string | number): string {
  const number = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(
    Number.isFinite(number) ? number : 0,
  );
}

function formatUsd(value: string): string {
  const match = /^(\d+)(?:\.(\d{1,8}))?$/.exec(value);
  if (!match) return "Unavailable";
  const whole = BigInt(match[1] ?? "0").toLocaleString("en-US");
  const exactFraction = (match[2] ?? "").padEnd(8, "0");
  const visibleFraction = exactFraction.replace(/0+$/, "").padEnd(2, "0");
  return `$${whole}.${visibleFraction}`;
}

function sumDecimals(values: string[]): string {
  const scale = 100_000_000n;
  const total = values.reduce((sum, value) => sum + BigInt(normalizeDecimal(value)), 0n);
  const whole = total / scale;
  const fraction = (total % scale).toString().padStart(8, "0");
  return `${whole}.${fraction}`;
}

function normalizeDecimal(value: string): string {
  const match = /^(\d+)(?:\.(\d{1,8}))?$/.exec(value);
  if (!match) throw new Error("Invalid retained USD aggregate.");
  return `${match[1]}${(match[2] ?? "").padEnd(8, "0")}`;
}

function weightedRate(
  rows: CopilotCostSummary["daily"],
  rate: "fallbackRate",
  weight: "callCount",
): number {
  const total = rows.reduce((sum, row) => sum + row[weight], 0);
  if (total === 0) return 0;
  return rows.reduce((sum, row) => sum + Number(row[rate]) * row[weight], 0) / total;
}
