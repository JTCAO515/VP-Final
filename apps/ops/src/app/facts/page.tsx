import { FactEditor } from "./ui";
import { requireOpsPage } from "../../lib/opsAccess";

export default async function FactsPage() {
  await requireOpsPage("knowledge.write");
  return (
    <>
      <section className="heading">
        <h1>知识事实编辑</h1>
        <p className="muted">
          先创建规范地点（POI），再录入独立溯源的事实。地点本身不代表已核验的旅行事实。
        </p>
      </section>
      <FactEditor />
    </>
  );
}
