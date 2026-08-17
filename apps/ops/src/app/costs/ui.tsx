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
      <section className="costStatus" aria-label="成本健康度">
        <CostMetric label="保留成本" value={formatUsd(totalCost)} />
        <CostMetric label="模型尝试次数" value={integer(totalCalls)} />
        <CostMetric label="缓存命中率" value={percent(cacheHitRate)} />
        <CostMetric label="降级率" value={percent(weightedFallback)} />
        <CostMetric
          danger={summary.reconciliation.unpricedCallCount > 0}
          label="未定价调用"
          value={integer(summary.reconciliation.unpricedCallCount)}
        />
      </section>

      <section className="panel costNotice" aria-label="每日预警状态">
        <div>
          <p className="eyebrow">每日预警</p>
          <strong>
            {budgetError ?? (budgetUsd ? `${formatUsd(budgetUsd)} 观察阈值` : "未配置")}
          </strong>
        </div>
        <p className="muted">这仅是运营预警，不会向旅行者收费，也不会停止模型服务。</p>
      </section>

      <CostTableSection title={`每日 · ${summary.fromDay} 至 ${summary.throughDay}`}>
        <table>
          <thead>
            <tr>
              <th>UTC 日期</th>
              <th>调用</th>
              <th>输入 / 缓存 / 输出 Token</th>
              <th>缓存命中</th>
              <th>降级</th>
              <th>成本</th>
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
          <p className="empty">此时间窗口内没有保留的调用记录。</p>
        ) : null}
      </CostTableSection>

      <CostTableSection title="按供应商和模型">
        <table>
          <thead>
            <tr>
              <th>供应商 / 模型</th>
              <th>工作等级</th>
              <th>调用</th>
              <th>缓存命中</th>
              <th>降级</th>
              <th>成本</th>
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
        {summary.byModel.length === 0 ? <p className="empty">此时间窗口内没有模型汇总。</p> : null}
      </CostTableSection>

      <CostTableSection title="主要私有身份引用">
        <table>
          <thead>
            <tr>
              <th>私有引用</th>
              <th>类型</th>
              <th>调用</th>
              <th>降级</th>
              <th>成本</th>
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
          <p className="empty">此时间窗口内没有身份汇总。</p>
        ) : null}
      </CostTableSection>

      <section
        className={`panel reconciliation ${summary.reconciliation.unpricedCallCount > 0 ? "needsReview" : ""}`}
      >
        <div>
          <p className="eyebrow">对账健康度</p>
          <h2>
            {summary.reconciliation.unpricedCallCount === 0
              ? "没有未定价的保留调用"
              : `${integer(summary.reconciliation.unpricedCallCount)} 次调用需要复核`}
          </h2>
        </div>
        <p className="muted">
          {summary.reconciliation.unpricedCallCount === 0
            ? "此时间窗口内的每次含 Token 调用都至少有一个价格快照。"
            : `${integer(summary.reconciliation.affectedModelCount)} 个模型配置受到影响。最早记录：${summary.reconciliation.oldestUnpricedAt ? new Date(summary.reconciliation.oldestUnpricedAt).toISOString() : "未知"}。`}
        </p>
      </section>
    </>
  );
}

export function CostsHeading() {
  return (
    <section className="heading costHeading">
      <div>
        <p className="eyebrow">VisePanda 运营</p>
        <h1>成本汇总</h1>
        <p className="muted">仅供对账的私有保留汇总。时间和每日边界均使用 UTC。</p>
      </div>
      <span className="pill">仅管理员</span>
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
  if (!match) return "暂不可用";
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
  if (!match) throw new Error("保留的美元汇总格式无效。");
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
