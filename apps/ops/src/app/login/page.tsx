import { redirect } from "next/navigation";
import { getOpsPageAccess } from "../../lib/opsAccess";
import { OpsLoginForm } from "./ui";

export default async function LoginPage() {
  const access = await getOpsPageAccess();
  if (access)
    redirect(
      access.role === "editor" ? "/facts" : access.role === "operator" ? "/tasks" : "/roles",
    );
  return <OpsLoginForm />;
}
