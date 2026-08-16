import { FactEditor } from "./ui";
import { requireOpsPage } from "../../lib/opsAccess";

export default async function FactsPage() {
  await requireOpsPage("knowledge.write");
  return (
    <>
      <section className="heading">
        <h1>Fact editor</h1>
        <p className="muted">
          Create canonical POIs, then add independently sourced facts. A POI is not a verified
          travel claim by itself.
        </p>
      </section>
      <FactEditor />
    </>
  );
}
