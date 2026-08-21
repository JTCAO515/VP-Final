import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LocaleProvider } from "../i18n/locale-provider";
import { DEFAULT_WEB_LOCALE, localeDirection } from "../i18n/locales";
import "./globals.css";

export const metadata: Metadata = {
  title: "VisePanda Early Access",
  description:
    "VisePanda is an AI planning and execution workspace for independent travel in China.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang={DEFAULT_WEB_LOCALE} dir={localeDirection(DEFAULT_WEB_LOCALE)}>
      <body className="min-h-screen overflow-x-clip bg-brand-bg font-sans text-brand-ink antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
