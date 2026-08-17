"use client";

import { LanguageSelector } from "../i18n/language-selector";
import { useLocale } from "../i18n/locale-provider";
import type { MessageKey } from "../i18n/messages";

type SiteSection = "copilot" | "explore" | "guides" | "rescue" | "help" | "account";

type SiteHeaderProps = Readonly<{
  active?: SiteSection;
  context?: string;
  contextKey?: MessageKey;
}>;

const NAV_ITEMS: ReadonlyArray<
  Readonly<{
    section: SiteSection;
    href: string;
    labelKey: "nav.visepanda" | "nav.explore" | "nav.guides" | "nav.rescue" | "nav.humanHelp";
  }>
> = [
  { section: "copilot", href: "/visepanda", labelKey: "nav.visepanda" },
  { section: "explore", href: "/explore", labelKey: "nav.explore" },
  { section: "guides", href: "/guides", labelKey: "nav.guides" },
  { section: "rescue", href: "/rescue", labelKey: "nav.rescue" },
  { section: "help", href: "/human-help", labelKey: "nav.humanHelp" },
];

export function SiteHeader({ active, context, contextKey }: SiteHeaderProps) {
  const { t } = useLocale();

  return (
    <>
      <a className="skipLink" href="#page-content">
        {t("skip.main")}
      </a>
      <header className="siteHeader">
        <a className="brandMark" href="/" aria-label={t("brand.home")}>
          <span aria-hidden="true">V</span>
          <b>VisePanda</b>
        </a>
        <nav className="siteNav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <a
              aria-current={active === item.section ? "page" : undefined}
              href={item.href}
              key={item.section}
            >
              {t(item.labelKey)}
            </a>
          ))}
        </nav>
        <div className="siteUtilities">
          <p className="siteContext">
            <span aria-hidden="true" />
            {contextKey ? t(contextKey) : (context ?? t("context.default"))}
          </p>
          <LanguageSelector />
          <a
            aria-current={active === "account" ? "page" : undefined}
            className="siteNavLink siteAccountLink"
            href="/account"
          >
            {t("nav.account")}
          </a>
        </div>
      </header>
      <span className="pageContentAnchor" id="page-content" tabIndex={-1} />
    </>
  );
}

export function SiteFooter() {
  const { t } = useLocale();

  return (
    <footer className="siteFooter">
      <a className="brandMark" href="/" aria-label={t("brand.home")}>
        <span aria-hidden="true">V</span>
        <b>VisePanda</b>
      </a>
      <p>{t("footer.description")}</p>
      <div className="siteFooterLinks">
        <nav aria-label={t("nav.product")}>
          <a href="/visepanda">VisePanda</a>
          <a href="/readiness">{t("footer.readiness")}</a>
          <a href="/arrival-pack">{t("footer.arrivalPack")}</a>
          <a href="/explore">{t("nav.explore")}</a>
          <a href="/guides">{t("nav.guides")}</a>
          <a href="/rescue">{t("nav.rescue")}</a>
          <a href="/human-help">{t("nav.humanHelp")}</a>
          <a href="/account">{t("nav.account")}</a>
        </nav>
        <nav aria-label={t("nav.legal")}>
          <a href="/privacy">{t("footer.privacy")}</a>
          <a href="/terms">{t("footer.terms")}</a>
          <a href="/affiliate-disclosure">{t("footer.affiliate")}</a>
          <a href="/human-help-disclaimer">{t("footer.humanHelpLimits")}</a>
          <a href="/emergency-disclaimer">{t("footer.emergency")}</a>
        </nav>
      </div>
    </footer>
  );
}
