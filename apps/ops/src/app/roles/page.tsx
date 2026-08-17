import { requireOpsPage } from "../../lib/opsAccess";
import { RoleManager } from "./ui";

export default async function RolesPage() {
  const access = await requireOpsPage("membership.read");
  return (
    <>
      <section className="heading">
        <h1>运营成员管理</h1>
        <p className="muted">
          为已注册协作者授予其所需的最小固定角色。成员变更会被审计，并在下一次受保护请求时生效。
        </p>
      </section>
      <RoleManager
        canWrite={access.permissions.includes("membership.write")}
        currentUserId={access.userId}
      />
    </>
  );
}
