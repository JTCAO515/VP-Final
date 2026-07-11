import { HumanTaskQueue } from "./ui";
import { requireOpsPage } from "../../lib/opsAccess";

export default async function TasksPage() {
  await requireOpsPage("task.read");
  return (
    <>
      <section className="heading">
        <h1>Human tasks</h1>
        <p className="muted">
          Minimal concierge queue. Prepare manual quotes and attach payment links after review.
        </p>
      </section>
      <HumanTaskQueue />
    </>
  );
}
