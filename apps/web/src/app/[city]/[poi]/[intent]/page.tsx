import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerCaller } from "../../../api/_server";
import { SiteFooter, SiteHeader } from "../../../site-chrome";
import { resolvePublicSeoPage, type PublicSeoPage } from "../../../seo-page-model";

export const dynamic = "force-dynamic";

type Props = Readonly<{
  params: Promise<{ city: string; poi: string; intent: string }>;
}>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await loadSeoPage(await params);
  if (!page) return { robots: { index: false, follow: false } };

  return {
    title: `${page.candidate.title} | VisePanda`,
    description: page.candidate.summary,
    alternates: { canonical: page.candidate.canonicalPath },
    openGraph: {
      title: page.candidate.title,
      description: page.candidate.summary,
      type: "article",
    },
  };
}

export default async function PublicSeoPoiPage({ params }: Props) {
  const page = await loadSeoPage(await params);
  if (!page) notFound();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: page.poi.nameEn,
    containedInPlace: { "@type": "City", name: page.poi.city },
    url: page.candidate.canonicalPath,
    dateModified: page.candidate.lastVerifiedAt,
  };

  return (
    <main className="shell guidePage">
      <SiteHeader active="explore" context={`${page.poi.city} evidence-backed guide`} />
      <section className="hero pageHero articleHero">
        <div>
          <p className="pageEyebrow">
            {page.poi.city} · {page.candidate.intent.replaceAll("_", " ")}
          </p>
          <h1>{page.candidate.title}</h1>
          <p>{page.candidate.summary}</p>
        </div>
        <div className="pageActionGroup">
          <a className="pageAction" href="/visepanda?context=explore">
            Ask VisePanda
          </a>
          <a className="pageAction secondaryPageAction" href="/explore">
            Back to Explore
          </a>
        </div>
      </section>

      <article className="guideArticle">
        <section>
          <h2>Current reviewed facts</h2>
          <div className="publicFactList">
            {page.facts.map((fact) => (
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
        </section>
        <section>
          <h2>Evidence boundary</h2>
          <p>
            This page includes only the current reviewed facts listed above. When evidence is absent
            or expires, VisePanda removes the candidate instead of filling the gap with a guess.
          </p>
        </section>
      </article>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
        type="application/ld+json"
      />
      <SiteFooter />
    </main>
  );
}

async function loadSeoPage(input: {
  city: string;
  poi: string;
  intent: string;
}): Promise<PublicSeoPage | null> {
  const pois = await getServerCaller().knowledge.listPois();
  return resolvePublicSeoPage(pois, {
    citySlug: input.city,
    poiSlug: input.poi,
    intentSegment: input.intent,
  });
}
