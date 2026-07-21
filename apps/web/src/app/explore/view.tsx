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
import { deriveExploreFacts } from "./factPresentation";

type ExploreViewProps = Readonly<{
  pois: Poi[];
  availability: "ready" | "unavailable";
  asOf: string;
}>;

export function ExploreView({ pois, availability, asOf }: ExploreViewProps) {
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

  return (
    <main className="shell">
      <SiteHeader active="explore" context="Verified place context" />
      <section className="hero pageHero">
        <div>
          <p className="pageEyebrow">Discover with context</p>
          <h1>Explore China</h1>
          <p>Scene tags are derived from verified POI facts. Missing facts stay quiet.</p>
        </div>
        <a className="pageAction" href="/">
          Ask Copilot
        </a>
      </section>

      <section className="exploreFilters" aria-label="Explore scene filters">
        <button
          className={selectedTag === "All" ? "active" : ""}
          onClick={() => setSelectedTag("All")}
          type="button"
        >
          All
        </button>
        {TRAVELER_SCENE_TAGS.map((tag) => (
          <button
            className={selectedTag === tag ? "active" : ""}
            key={tag}
            onClick={() => setSelectedTag(tag)}
            type="button"
          >
            {tag}
          </button>
        ))}
      </section>

      <section className="poiGrid">
        {availability === "unavailable" ? (
          <div className="exploreEmpty" role="status">
            <h2>Explore data is unavailable</h2>
            <p>Verified place facts could not be loaded. Please try again later.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="exploreEmpty" role="status">
            <h2>No verified places match</h2>
            <p>Try another scene filter. We do not fill gaps with unverified claims.</p>
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
              <div className="poiFacts" aria-label="Verified travel facts">
                <strong>Verified travel facts</strong>
                <ul>
                  {facts.map((fact) => (
                    <li key={fact.id}>
                      <span className="factKind">{fact.kind}</span>
                      <div>
                        <b>{fact.label}</b>
                        <small>
                          {fact.provenance.sourceLabel} · Verified{" "}
                          {fact.provenance.verifiedDateLabel}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {href ? (
              <a className="poiLink" href={`/${href.citySlug}/${href.poiSlug}`}>
                Open guide
              </a>
            ) : null}
            {tags.length > 0 ? (
              <div className="sceneTags">
                {tags.map((tag) => (
                  <span key={tag}>{tag}</span>
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
