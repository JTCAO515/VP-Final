import { requireOpsPage } from "../../lib/opsAccess";
import GapsPageContent from "./ui";

export default async function GapsPage() {
  await requireOpsPage("knowledge.read");
  return <GapsPageContent />;
}
