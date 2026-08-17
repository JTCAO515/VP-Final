import { requireOpsPage } from "../../lib/opsAccess";
import { AuditLedger } from "./ui";

export default async function AuditPage() {
  await requireOpsPage("membership.read");
  return (
    <>
      <section className="heading">
        <h1>运营审计记录</h1>
        <p className="muted">用于敏感运营操作的只读证据；记录仅保留在限定的时间窗口内。</p>
      </section>
      <AuditLedger />
    </>
  );
}
