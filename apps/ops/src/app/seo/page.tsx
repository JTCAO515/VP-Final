import { requireOpsPage } from "../../lib/opsAccess";
import { SeoEditorialOverrideEditor } from "./ui";

export default async function SeoEditorialOverridesPage() {
  await requireOpsPage("knowledge.read");
  return (
    <>
      <section className="heading">
        <h1>SEO 编辑文案覆盖</h1>
        <p className="muted">
          仅用于当前有证据支持的地点页面展示文案。覆盖文案绝不会改变地点事实、来源或资格。
        </p>
      </section>
      <SeoEditorialOverrideEditor />
    </>
  );
}
