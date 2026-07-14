import type { Metadata } from "next";
import type { ReactNode } from "react";
import { designTokenCss } from "@visepanda/ui";
import "./styles.css";

export const metadata: Metadata = {
  title: "VisePanda Copilot",
  description: "China travel copilot for planning and execution.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <style id="visepanda-design-tokens">{designTokenCss}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
