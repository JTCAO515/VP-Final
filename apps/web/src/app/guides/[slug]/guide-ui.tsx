"use client";

import { useLocale } from "../../../i18n/locale-provider";

export function GuideEyebrow() {
  const { t } = useLocale();
  return <p className="pageEyebrow">{t("guide.eyebrow")}</p>;
}

export function GuideAskAction() {
  const { t } = useLocale();
  return (
    <a className="pageAction" href="/visepanda?context=guide">
      {t("guide.ask")}
    </a>
  );
}

export function GuideFaqHeading() {
  const { t } = useLocale();
  return <h2>{t("guide.faq")}</h2>;
}
