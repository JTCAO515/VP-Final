import { requireOpsPage } from "../../lib/opsAccess";
import { RoleManager } from "./ui";

export default async function RolesPage() {
  await requireOpsPage("membership.read");
  return (
    <>
      <section className="heading">
        <h1>Ops memberships</h1>
        <p className="muted">
          Assign one explicit least-privilege role to a verified Supabase user id.
        </p>
      </section>
      <RoleManager />
    </>
  );
}
