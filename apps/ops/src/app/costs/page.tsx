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
    budgetError = "Daily warning configuration is invalid.";
  }

  try {
    const summary = await getOpsCostSummaryService().getSummary(access, { windowDays: 14 });
    return <CostSummaryView budgetError={budgetError} budgetUsd={budgetUsd} summary={summary} />;
  } catch {
    return (
      <>
        <CostsHeading />
        <section className="panel costUnavailable" role="status">
          <p className="eyebrow">Unavailable</p>
          <h2>Cost records cannot be loaded</h2>
          <p className="muted">
            The private database summary is unavailable. No zero-cost or sample data has been
            substituted. Check the Ops database configuration and try again.
          </p>
        </section>
      </>
    );
  }
}
