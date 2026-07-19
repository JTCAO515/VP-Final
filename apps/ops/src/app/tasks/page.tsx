import { HumanTaskQueue } from "./ui";
import { requireOpsPage } from "../../lib/opsAccess";

export default async function TasksPage() {
  await requireOpsPage("task.contact.read");
  return (
    <>
      <section className="heading">
        <h1>Human tasks</h1>
        <p className="muted">
          Shanghai controlled-preview intake. Open a task to record triage notes or an allowed
          lifecycle decision. Quoting and payment controls remain unavailable.
        </p>
      </section>
      <HumanTaskQueue />
    </>
  );
}
