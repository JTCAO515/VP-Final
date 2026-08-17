import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoleManager } from "./ui";

const currentUserId = "40000000-0000-4000-8000-000000000001";

describe("RoleManager", () => {
  it("uses a complete email assignment flow and explains fixed least-privilege roles", () => {
    const html = renderToStaticMarkup(<RoleManager canWrite currentUserId={currentUserId} />);

    expect(html).toContain("已注册邮箱地址");
    expect(html).toContain("添加协作者");
    expect(html).toContain("运营后台不会搜索或浏览用户账号");
    expect(html).toContain("知识编辑");
    expect(html).toContain("人工协助专员");
    expect(html).toContain("运营管理员");
    expect(html).toContain("高风险权限");
    expect(html).toContain("可查看全部成本汇总");
    expect(html).not.toContain("Supabase user UUID");
  });

  it("does not render a membership mutation form for a read-only viewer", () => {
    const html = renderToStaticMarkup(
      <RoleManager canWrite={false} currentUserId={currentUserId} />,
    );

    expect(html).toContain("只有运营管理员可以更改它们");
    expect(html).not.toContain("添加协作者</button>");
  });

  it("renders the current collaborator as self-managed only by the server and disables local controls", () => {
    const html = renderToStaticMarkup(
      <RoleManager
        canWrite
        currentUserId={currentUserId}
        initialMemberships={[
          {
            userId: currentUserId,
            role: "admin",
            createdBy: null,
            createdAt: "2026-08-16T00:00:00.000Z",
            updatedAt: "2026-08-16T00:00:00.000Z",
            revokedAt: null,
            revokedBy: null,
          },
        ]}
      />,
    );

    expect(html).toContain("你不能更改自己的访问权限。");
    expect(html).not.toContain("移除权限");
    expect(html).toContain('disabled=""');
  });
});
