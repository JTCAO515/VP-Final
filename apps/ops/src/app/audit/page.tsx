import { requireOpsPage } from "../../lib/opsAccess";
import { AuditLedger } from "./ui";

export default async function AuditPage() {
  await requireOpsPage("membership.read");
  return (
    <>
      <section className="heading">
        <h1>Ops audit ledger</h1>
        <p className="muted">
          Read-only evidence for sensitive Ops actions. Entries are limited to a bounded time
          window.
        </p>
      </section>
      <AuditLedger />
    </>
  );
}
