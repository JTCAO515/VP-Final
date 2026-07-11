import Link from "next/link";
import { redirect } from "next/navigation";
import { getOpsPageAccess } from "../../lib/opsAccess";

export default async function ForbiddenPage() {
  const access = await getOpsPageAccess();
  if (!access) redirect("/login");
  const home =
    access.role === "editor" ? "/facts" : access.role === "operator" ? "/tasks" : "/roles";
  return (
    <section className="loginPanel">
      <p className="eyebrow">Access denied</p>
      <h1>Your {access.role} role cannot open this area</h1>
      <p className="muted">
        Permissions are enforced by the server, including direct API requests.
      </p>
      <Link href={home}>Return to your workspace</Link>
    </section>
  );
}
