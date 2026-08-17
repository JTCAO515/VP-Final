import Link from "next/link";
import { redirect } from "next/navigation";
import { getOpsPageAccess } from "../../lib/opsAccess";
import { displayOpsRole } from "../../lib/presentation";

export default async function ForbiddenPage() {
  const access = await getOpsPageAccess();
  if (!access) redirect("/login");
  const home =
    access.role === "editor" ? "/facts" : access.role === "operator" ? "/tasks" : "/roles";
  return (
    <section className="loginPanel">
      <p className="eyebrow">访问被拒绝</p>
      <h1>你当前的 {displayOpsRole(access.role)} 无权访问此区域</h1>
      <p className="muted">权限由服务端强制执行，直接调用 API 也同样受限。</p>
      <Link href={home}>返回工作区</Link>
    </section>
  );
}
