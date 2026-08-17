import { requireOpsPage } from "../../lib/opsAccess";
import { PartnerManager } from "./ui";

export default async function PartnersPage() {
  await requireOpsPage("partner.read");
  return (
    <>
      <section className="heading partnerHeading">
        <div>
          <p className="eyebrow">商业控制</p>
          <h1>合作伙伴配置</h1>
          <p className="muted">
            在通过单独的状态操作使合作伙伴具备资格前，请核验精确主机名和覆盖范围。
          </p>
        </div>
        <span className="pill">仅管理员</span>
      </section>
      <PartnerManager />
    </>
  );
}
