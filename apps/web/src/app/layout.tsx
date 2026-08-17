import type { Metadata } from "next";
import type { ReactNode } from "react";
import { designTokenCss } from "@visepanda/ui";
import { LocaleProvider } from "../i18n/locale-provider";
import { DEFAULT_WEB_LOCALE, localeDirection } from "../i18n/locales";
import "./styles.css";

export const metadata: Metadata = {
  title: "VisePanda",
  description: "China Travel AI Copilot for planning and practical execution.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html dir={localeDirection(DEFAULT_WEB_LOCALE)} lang={DEFAULT_WEB_LOCALE}>
      <head>
        <style id="visepanda-design-tokens">{designTokenCss}</style>
      </head>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
