import { FactEditor } from "./ui";
import { requireOpsPage } from "../../lib/opsAccess";

export default async function FactsPage() {
  await requireOpsPage("knowledge.read");
  return (
    <>
      <section className="heading">
        <h1>Fact editor</h1>
        <p className="muted">
          Seeded Beijing and Shanghai POI facts. Edits write through to the read API.
        </p>
      </section>
      <FactEditor />
    </>
  );
}
