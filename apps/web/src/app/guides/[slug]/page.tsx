import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIDES, getGuide } from "../data";
import { SiteFooter, SiteHeader } from "../../site-chrome";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return {};

  return {
    title: guide.title,
    description: guide.description,
    openGraph: {
      title: guide.ogTitle,
      description: guide.description,
      type: "article",
    },
  };
}

export default async function GuidePage({ params }: Props) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();

  return (
    <main className="shell guidePage">
      <SiteHeader active="explore" context="China travel guide" />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(guide)) }}
        type="application/ld+json"
      />
      <section className="hero pageHero articleHero">
        <div>
          <p className="pageEyebrow">Practical guide</p>
          <h1>{guide.title}</h1>
          <p>{guide.description}</p>
        </div>
        <a className="pageAction" href="/">
          Ask Copilot
        </a>
      </section>

      <article className="guideArticle">
        {guide.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}

        <section>
          <h2>FAQ</h2>
          {guide.faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </section>
      </article>
      <SiteFooter />
    </main>
  );
}

function faqJsonLd(guide: (typeof GUIDES)[number]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guide.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
