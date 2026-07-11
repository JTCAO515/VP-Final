import { redirect } from "next/navigation";
import { getOpsPageAccess } from "../lib/opsAccess";

export default async function Page() {
  const access = await getOpsPageAccess();
  if (!access) redirect("/login");
  redirect(access.role === "editor" ? "/facts" : access.role === "operator" ? "/tasks" : "/roles");
}
