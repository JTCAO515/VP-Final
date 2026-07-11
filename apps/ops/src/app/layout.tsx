import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./styles.css";
import { getOpsPageAccess } from "../lib/opsAccess";
import { LogoutButton } from "./logout-button";

export const metadata: Metadata = {
  title: "VisePanda Ops",
  description: "Minimal VisePanda operations console.",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const access = await getOpsPageAccess();
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div>
            <strong>VisePanda Ops</strong>
            <span>Phase 0</span>
          </div>
          <nav>
            {access?.permissions.includes("task.read") ? <Link href="/tasks">Tasks</Link> : null}
            {access?.permissions.includes("knowledge.read") ? (
              <Link href="/facts">Facts</Link>
            ) : null}
            {access?.permissions.includes("knowledge.read") ? <Link href="/gaps">Gaps</Link> : null}
            {access?.permissions.includes("membership.read") ? (
              <Link href="/roles">Roles</Link>
            ) : null}
            {access ? <LogoutButton /> : <Link href="/login">Sign in</Link>}
          </nav>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
