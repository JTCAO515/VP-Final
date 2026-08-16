import { requireOpsPage } from "../../lib/opsAccess";
import { RoleManager } from "./ui";

export default async function RolesPage() {
  const access = await requireOpsPage("membership.read");
  return (
    <>
      <section className="heading">
        <h1>Ops memberships</h1>
        <p className="muted">
          Give registered collaborators the smallest fixed role they need. Membership changes are
          audited and take effect on the next protected request.
        </p>
      </section>
      <RoleManager
        canWrite={access.permissions.includes("membership.write")}
        currentUserId={access.userId}
      />
    </>
  );
}
