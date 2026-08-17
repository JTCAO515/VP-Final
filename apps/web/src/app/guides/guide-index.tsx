"use client";

import { useLocale } from "../../i18n/locale-provider";
import type { Guide } from "./data";

export function GuideIndex({ guides }: Readonly<{ guides: readonly Guide[] }>) {
  const { t } = useLocale();

  return (
    <>
      <section className="hero pageHero">
        <div>
          <p className="pageEyebrow">{t("guide.eyebrow")}</p>
          <h1>{t("nav.guides")}</h1>
        </div>
      </section>
      <section className="guideIndex" aria-label={t("nav.guides")}>
        {guides.map((guide) => (
          <article className="guideIndexCard" key={guide.slug}>
            <div>
              <p className="pageEyebrow">{t("guide.eyebrow")}</p>
              <h2>{guide.title}</h2>
              <p>{guide.description}</p>
            </div>
            <a className="pageAction" href={`/guides/${guide.slug}`}>
              {t("explore.openGuide")}
            </a>
          </article>
        ))}
      </section>
    </>
  );
}
