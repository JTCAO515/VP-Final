"use client";

import { useMemo, useState } from "react";
import {
  TRAVELER_SCENE_TAGS,
  derivePoiSceneTags,
  type Poi,
  type TravelerSceneTag,
} from "@visepanda/domain";

export function ExploreView({ pois }: Readonly<{ pois: Poi[] }>) {
  const [selectedTag, setSelectedTag] = useState<TravelerSceneTag | "All">("All");
  const rows = useMemo(
    () =>
      pois
        .map((poi) => ({ poi, tags: derivePoiSceneTags(poi) }))
        .filter(({ tags }) => selectedTag === "All" || tags.includes(selectedTag)),
    [pois, selectedTag],
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
        {rows.map(({ poi, tags }) => (
          <article className="poiCard" key={poi.id}>
            <div>
              <span>{poi.city}</span>
              <span>{poi.category}</span>
            </div>
            <h2>{poi.nameEn}</h2>
            {poi.nameZh ? <p>{poi.nameZh}</p> : null}
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
