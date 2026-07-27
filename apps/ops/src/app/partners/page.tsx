import { requireOpsPage } from "../../lib/opsAccess";
import { PartnerManager } from "./ui";

export default async function PartnersPage() {
  await requireOpsPage("partner.read");
  return (
    <>
      <section className="heading partnerHeading">
        <div>
          <p className="eyebrow">Commercial controls</p>
          <h1>Partner configuration</h1>
          <p className="muted">
            Review exact hosts and coverage before a separate status action makes a partner
            eligible.
          </p>
        </div>
        <span className="pill">Admin only</span>
      </section>
      <PartnerManager />
    </>
  );
}
