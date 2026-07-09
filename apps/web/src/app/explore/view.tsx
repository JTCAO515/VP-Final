"use client";

import { useMemo, useState } from "react";
import {
  TRAVELER_SCENE_TAGS,
  derivePoiSceneTags,
  type Poi,
  type TravelerSceneTag,
} from "@visepanda/domain";
import { poiEntries } from "../poiSeo";

export function ExploreView({ pois }: Readonly<{ pois: Poi[] }>) {
  const [selectedTag, setSelectedTag] = useState<TravelerSceneTag | "All">("All");
  const entries = useMemo(() => poiEntries(), []);
  const rows = useMemo(
    () =>
      pois
        .map((poi) => ({
          poi,
          href: entries.find((entry) => entry.poi.id === poi.id),
          tags: derivePoiSceneTags(poi),
        }))
        .filter(({ tags }) => selectedTag === "All" || tags.includes(selectedTag)),
    [entries, pois, selectedTag],
  );

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <h1>Explore China</h1>
          <p>Scene tags are derived from verified POI facts. Missing facts stay quiet.</p>
        </div>
        <a className="status" href="/">
          Copilot
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
        {rows.map(({ href, poi, tags }) => (
          <article className="poiCard" key={poi.id}>
            <div>
              <span>{poi.city}</span>
              <span>{poi.category}</span>
            </div>
            <h2>{poi.nameEn}</h2>
            {poi.nameZh ? <p>{poi.nameZh}</p> : null}
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
    </main>
  );
}
