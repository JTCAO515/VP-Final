import { resolveDailyLlmBudgetUsd } from "@visepanda/app-server";
import { requireOpsPage } from "../../lib/opsAccess";
import { getOpsCostSummaryService } from "../../lib/opsCostSummary";
import { CostsHeading, CostSummaryView } from "./ui";

export default async function CostsPage() {
  const access = await requireOpsPage("cost.read");
  let budgetUsd: string | null = null;
  let budgetError: string | null = null;
  try {
    budgetUsd = resolveDailyLlmBudgetUsd(process.env);
  } catch {
    budgetError = "每日预警配置无效。";
  }

  try {
    const summary = await getOpsCostSummaryService().getSummary(access, { windowDays: 14 });
    return <CostSummaryView budgetError={budgetError} budgetUsd={budgetUsd} summary={summary} />;
  } catch {
    return (
      <>
        <CostsHeading />
        <section className="panel costUnavailable" role="status">
          <p className="eyebrow">暂不可用</p>
          <h2>无法加载成本记录</h2>
          <p className="muted">
            私有数据库汇总暂不可用。系统未以零成本或示例数据替代，请检查运营后台数据库配置后重试。
          </p>
        </section>
      </>
    );
  }
}
