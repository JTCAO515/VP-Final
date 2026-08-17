import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { designTokenCss } from "@visepanda/ui";
import "./styles.css";
import { getOpsPageAccess } from "../lib/opsAccess";
import { LogoutButton } from "./logout-button";

export const metadata: Metadata = {
  title: "VisePanda 运营后台",
  description: "VisePanda 内部运营后台。",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const access = await getOpsPageAccess();
  return (
    <html lang="zh-CN">
      <head>
        <style id="visepanda-design-tokens">{designTokenCss}</style>
      </head>
      <body>
        <header className="topbar">
          <div>
            <strong>VisePanda 运营后台</strong>
            <span>阶段 0</span>
          </div>
          <nav>
            {access?.permissions.includes("task.read") ? <Link href="/tasks">任务</Link> : null}
            {access?.permissions.includes("knowledge.read") ? (
              <Link href="/facts">知识事实</Link>
            ) : null}
            {access?.permissions.includes("knowledge.read") ? (
              <Link href="/gaps">知识缺口</Link>
            ) : null}
            {access?.permissions.includes("knowledge.read") ? (
              <Link href="/seo">SEO 文案</Link>
            ) : null}
            {access?.permissions.includes("membership.read") ? (
              <Link href="/roles">成员与角色</Link>
            ) : null}
            {access?.permissions.includes("membership.read") ? (
              <Link href="/audit">审计记录</Link>
            ) : null}
            {access?.permissions.includes("cost.read") ? <Link href="/costs">成本</Link> : null}
            {access?.permissions.includes("partner.read") ? (
              <Link href="/partners">合作伙伴</Link>
            ) : null}
            {access ? <LogoutButton /> : <Link href="/login">登录</Link>}
          </nav>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
