import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { derivePoiSceneTags } from "@visepanda/domain";
import { findPoiEntry, poiDescription, poiEntries } from "../../poiSeo";
import { toPublicPoiFact } from "../../publicPoiFactPresentation";
import { SiteFooter, SiteHeader } from "../../site-chrome";

export const revalidate = 86400;

type Props = {
  params: Promise<{ city: string; poi: string }>;
};

export function generateStaticParams() {
  return poiEntries().map((entry) => ({
    city: entry.citySlug,
    poi: entry.poiSlug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, poi } = await params;
  const entry = findPoiEntry(city, poi);
  if (!entry) return {};

  return {
    title: `${entry.poi.nameEn} guide | ${entry.poi.city}`,
    description: poiDescription(entry.poi),
    openGraph: {
      title: `${entry.poi.nameEn} in ${entry.poi.city}`,
      description: poiDescription(entry.poi),
      type: "article",
    },
  };
}

export default async function PoiPage({ params }: Props) {
  const { city, poi } = await params;
  const entry = findPoiEntry(city, poi);
  if (!entry) notFound();

  const tags = derivePoiSceneTags(entry.poi);
  const facts = entry.poi.facts.flatMap((fact) => {
    const presentation = toPublicPoiFact(fact);
    return presentation === null ? [] : [presentation];
  });

  return (
    <main className="shell guidePage">
      <SiteHeader active="explore" context={`${entry.poi.city} place guide`} />
      <section className="hero pageHero articleHero">
        <div>
          <p className="pageEyebrow">
            {entry.poi.city} · {entry.poi.category}
          </p>
          <h1>{entry.poi.nameEn}</h1>
          <p>{poiDescription(entry.poi)}</p>
        </div>
        <a className="pageAction" href="/explore">
          Back to Explore
        </a>
      </section>

      <article className="guideArticle">
        <section>
          <h2>Travel fit</h2>
          {tags.length > 0 ? (
            <div className="sceneTags">
              {tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : (
            <p>No verified fit tags yet.</p>
          )}
        </section>

        <section>
          <h2>Known facts</h2>
          {facts.length > 0 ? (
            <div className="publicFactList">
              {facts.map((fact) => (
                <div className="publicFact" key={fact.id}>
                  <p>
                    <strong>{fact.factType}:</strong> {fact.label}
                  </p>
                  <small>
                    {fact.provenance.sourceLabel} · Verified {fact.provenance.verifiedDateLabel}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <p>No current reviewed facts yet.</p>
          )}
        </section>
      </article>
      <SiteFooter />
    </main>
  );
}
