import type { LegalDocument } from "./legal-content";
import { LEGAL_CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE } from "./legal-content";
import { SiteFooter, SiteHeader } from "./site-chrome";

export function LegalPage({ document }: Readonly<{ document: LegalDocument }>) {
  return (
    <main className="shell legalPage">
      <SiteHeader context="Trust & legal" />
      <header className="legalHero">
        <div>
          <p className="pageEyebrow">{document.eyebrow}</p>
          <h1>{document.title}</h1>
          <p>{document.summary}</p>
        </div>
        <dl className="legalMeta">
          <div>
            <dt>Effective</dt>
            <dd>{LEGAL_EFFECTIVE_DATE}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
            </dd>
          </div>
        </dl>
      </header>

      <div className="legalLayout">
        <nav aria-label={`On this page: ${document.title}`} className="legalToc">
          <b>On this page</b>
          {document.sections.map((section) => (
            <a href={`#${sectionId(section.heading)}`} key={section.heading}>
              {section.heading}
            </a>
          ))}
        </nav>

        <article className="legalArticle">
          <p className="legalNotice">
            This page records the current VisePanda controlled-preview boundary. It is general
            information, not legal advice.
          </p>
          {document.sections.map((section) => (
            <section id={sectionId(section.heading)} key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
              {section.links ? (
                <div className="legalLinks">
                  {section.links.map((link) => (
                    <a
                      href={link.href}
                      key={link.href}
                      rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </article>
      </div>
      <SiteFooter />
    </main>
  );
}

function sectionId(heading: string) {
  return heading
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
}
