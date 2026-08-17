import { HumanTaskQueue } from "./ui";
import { requireOpsPage } from "../../lib/opsAccess";

export default async function TasksPage() {
  await requireOpsPage("task.contact.read");
  return (
    <>
      <section className="heading">
        <h1>人工协助任务</h1>
        <p className="muted">
          上海受控预览请求。打开任务可记录分诊备注或允许的生命周期决策；报价与支付控制仍不可用。
        </p>
      </section>
      <HumanTaskQueue />
    </>
  );
}
