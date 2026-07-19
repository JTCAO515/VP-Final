import { requireOpsPage } from "../../../lib/opsAccess";
import { HumanTaskDetail } from "./ui";

export default async function TaskDetailPage({
  params,
}: Readonly<{ params: Promise<{ taskId: string }> }>) {
  await requireOpsPage("task.contact.read");
  const { taskId } = await params;

  return (
    <>
      <a className="backLink" href="/tasks">
        Back to task queue
      </a>
      <HumanTaskDetail taskId={taskId} />
    </>
  );
}
