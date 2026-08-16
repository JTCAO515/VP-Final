"use client";

import { useMemo, useState } from "react";
import {
  TRAVELER_SCENE_TAGS,
  derivePoiSceneTags,
  type Poi,
  type TravelerSceneTag,
} from "@visepanda/domain";
import { poiEntries } from "../poiSeo";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { captureClientTelemetry } from "../../lib/clientTelemetry";
import { useLocale } from "../../i18n/locale-provider";
import type { MessageKey } from "../../i18n/messages";
import { exploreCommercialLinkHref } from "./commercialLink";
import { deriveExploreFacts } from "./factPresentation";

type ExploreViewProps = Readonly<{
  pois: Poi[];
  availability: "ready" | "unavailable";
  asOf: string;
}>;

export function ExploreView({ pois, availability, asOf }: ExploreViewProps) {
  const { t } = useLocale();
  const [selectedTag, setSelectedTag] = useState<TravelerSceneTag | "All">("All");
  const entries = useMemo(() => poiEntries(), []);
  const referenceTime = useMemo(() => new Date(asOf), [asOf]);
  const rows = useMemo(
    () =>
      pois
        .map((poi) => ({
          poi,
          href: entries.find((entry) => entry.poi.id === poi.id),
          facts: deriveExploreFacts(poi, referenceTime),
          tags: derivePoiSceneTags(poi, referenceTime),
        }))
        .filter(({ tags }) => selectedTag === "All" || tags.includes(selectedTag)),
    [entries, pois, referenceTime, selectedTag],
  );

  function selectScene(tag: TravelerSceneTag | "All"): void {
    if (tag !== "All" && tag !== selectedTag) {
      captureClientTelemetry({
        action: "scene_filter_used",
        entity_type: "explore_scene",
        entity_id: "scene-filter",
        props_jsonb: { scene: tag },
      });
    }
    setSelectedTag(tag);
  }

  return (
    <main className="shell">
      <SiteHeader active="explore" contextKey="context.explore" />
      <section className="hero pageHero">
        <div>
          <p className="pageEyebrow">{t("explore.eyebrow")}</p>
          <h1>{t("explore.title")}</h1>
          <p>{t("explore.lead")}</p>
        </div>
        <a className="pageAction" href="/visepanda?context=explore">
          {t("explore.ask")}
        </a>
      </section>

      <section className="exploreFilters" aria-label={t("explore.filters")}>
        <button
          className={selectedTag === "All" ? "active" : ""}
          onClick={() => selectScene("All")}
          type="button"
        >
          {t("explore.all")}
        </button>
        {TRAVELER_SCENE_TAGS.map((tag) => (
          <button
            className={selectedTag === tag ? "active" : ""}
            key={tag}
            onClick={() => selectScene(tag)}
            type="button"
          >
            {t(sceneKey(tag))}
          </button>
        ))}
      </section>

      <section className="poiGrid">
        {availability === "unavailable" ? (
          <div className="exploreEmpty" role="status">
            <h2>{t("explore.unavailable.title")}</h2>
            <p>{t("explore.unavailable.lead")}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="exploreEmpty" role="status">
            <h2>{t("explore.empty.title")}</h2>
            <p>{t("explore.empty.lead")}</p>
          </div>
        ) : null}
        {rows.map(({ facts, href, poi, tags }) => (
          <article className="poiCard" key={poi.id}>
            <div>
              <span>{poi.city}</span>
              <span>{poi.category}</span>
            </div>
            <h2>{poi.nameEn}</h2>
            {poi.nameZh ? <p>{poi.nameZh}</p> : null}
            {facts.length > 0 ? (
              <div className="poiFacts" aria-label={t("explore.facts")}>
                <strong>{t("explore.facts")}</strong>
                <ul>
                  {facts.map((fact) => (
                    <li key={fact.id}>
                      <span className="factKind">{t(factKey(fact.kind))}</span>
                      <div>
                        <b>{fact.label}</b>
                        <small>
                          {fact.provenance.sourceLabel} · {t("explore.verified")}{" "}
                          {fact.provenance.verifiedDateLabel}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {href ? (
              <a
                className="poiLink"
                href={`/${href.citySlug}/${href.poiSlug}`}
                onClick={() =>
                  captureClientTelemetry({
                    action: "poi_viewed",
                    entity_type: "poi",
                    entity_id: poi.id,
                    props_jsonb: { city: poi.city, category: poi.category },
                  })
                }
              >
                {t("explore.openGuide")}
              </a>
            ) : null}
            {poi.commercialLinks.length > 0 ? (
              <div className="poiCommercialLinks" aria-label={t("explore.partners")}>
                {poi.commercialLinks.map((link) => (
                  <div className="poiCommercialLink" key={link.id}>
                    <a
                      className="poiLink"
                      href={exploreCommercialLinkHref(link, poi.id)}
                      rel="noreferrer"
                    >
                      {t("explore.continuePartner")}
                    </a>
                    <small>{link.disclosure}</small>
                  </div>
                ))}
              </div>
            ) : null}
            {tags.length > 0 ? (
              <div className="sceneTags">
                {tags.map((tag) => (
                  <span key={tag}>{t(sceneKey(tag))}</span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </section>
      <SiteFooter />
    </main>
  );
}

function sceneKey(tag: TravelerSceneTag): MessageKey {
  const keys: Readonly<Record<TravelerSceneTag, MessageKey>> = {
    "Avoid peak hours": "explore.scene.peak",
    "First time in China": "explore.scene.firstTime",
    "Good in rain": "explore.scene.rain",
    "Low Mandarin": "explore.scene.lowMandarin",
    "Near metro": "explore.scene.metro",
  };
  return keys[tag];
}

function factKey(kind: string): MessageKey {
  const keys: Readonly<Record<string, MessageKey>> = {
    Booking: "explore.fact.booking",
    Crowds: "explore.fact.crowds",
    Metro: "explore.fact.metro",
    Payment: "explore.fact.payment",
    Rain: "explore.fact.rain",
  };
  return keys[kind] ?? "explore.facts";
}
