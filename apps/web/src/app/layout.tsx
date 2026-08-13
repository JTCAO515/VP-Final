import type { Metadata } from "next";
import type { ReactNode } from "react";
import { designTokenCss } from "@visepanda/ui";
import "./styles.css";

export const metadata: Metadata = {
  title: "VisePanda",
  description: "China Travel AI Copilot for planning and practical execution.",
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
