import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./styles.css";

export const metadata: Metadata = {
  title: "VisePanda Ops",
  description: "Minimal VisePanda operations console.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div>
            <strong>VisePanda Ops</strong>
            <span>Phase 0</span>
          </div>
          <nav>
            <Link href="/tasks">Tasks</Link>
            <Link href="/facts">Facts</Link>
            <Link href="/gaps">Gaps</Link>
          </nav>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
