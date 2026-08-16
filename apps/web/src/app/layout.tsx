import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { designTokenCss } from "@visepanda/ui";
import { LocaleProvider } from "../i18n/locale-provider";
import { WEB_LOCALE_COOKIE, localeDirection, parseWebLocale } from "../i18n/locales";
import "./styles.css";

export const metadata: Metadata = {
  title: "VisePanda",
  description: "China Travel AI Copilot for planning and practical execution.",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = parseWebLocale((await cookies()).get(WEB_LOCALE_COOKIE)?.value);

  return (
    <html dir={localeDirection(locale)} lang={locale}>
      <head>
        <style id="visepanda-design-tokens">{designTokenCss}</style>
      </head>
      <body>
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
