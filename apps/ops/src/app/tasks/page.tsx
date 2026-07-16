import { HumanTaskQueue } from "./ui";
import { requireOpsPage } from "../../lib/opsAccess";

export default async function TasksPage() {
  await requireOpsPage("task.contact.read");
  return (
    <>
      <section className="heading">
        <h1>Human tasks</h1>
        <p className="muted">
          Read-only Shanghai preview intake. Triage, quoting, and payment controls are not active
          yet.
        </p>
      </section>
      <HumanTaskQueue />
    </>
  );
}
