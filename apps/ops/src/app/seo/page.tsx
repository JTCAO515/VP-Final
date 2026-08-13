import { requireOpsPage } from "../../lib/opsAccess";
import { SeoEditorialOverrideEditor } from "./ui";

export default async function SeoEditorialOverridesPage() {
  await requireOpsPage("knowledge.read");
  return (
    <>
      <section className="heading">
        <h1>SEO editorial overrides</h1>
        <p className="muted">
          Presentation-only copy for currently evidence-backed POI pages. Overrides never change POI
          facts, sources, or eligibility.
        </p>
      </section>
      <SeoEditorialOverrideEditor />
    </>
  );
}
