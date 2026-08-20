"use client";

import { LanguageSelector } from "../../i18n/language-selector";
import { useLocale } from "../../i18n/locale-provider";
import { EarlyAccessForm } from "./early-access-form";
import { landingCopyFor, type LandingCopy } from "./copy";

const TIMES = ["09:30", "12:30", "15:00", "19:00"] as const;

export function EarlyAccessLanding() {
  const { locale } = useLocale();
  const copy = landingCopyFor(locale);

  return (
    <main className="landingPage" id="page-content">
      <a className="landingSkipLink" href="#landing-main">
        {copy.skip}
      </a>
      <header className="landingNav" aria-label={copy.navLabel}>
        <a className="landingBrand" href="/" aria-label="VisePanda home">
          <span aria-hidden="true">V</span>
          <b>VisePanda</b>
        </a>
        <LanguageSelector />
      </header>

      <div id="landing-main">
        <section className="landingHero" aria-labelledby="landing-title">
          <div className="landingHeroCopy">
            <p className="landingEyebrow">{copy.eyebrow}</p>
            <h1 id="landing-title">{copy.title}</h1>
            <p className="landingLead">{copy.lead}</p>
            <EarlyAccessForm copy={copy} locale={locale} />
          </div>
          <ProductPreview copy={copy} />
        </section>

        <section className="landingSection landingScenarios" aria-labelledby="scenarios-title">
          <div className="landingSectionIntro">
            <p className="landingEyebrow">{copy.scenariosEyebrow}</p>
            <h2 id="scenarios-title">{copy.scenariosTitle}</h2>
          </div>
          <div className="landingScenarioGrid">
            {copy.scenarios.map((scenario) => (
              <article key={scenario.number} className="landingScenario">
                <span>{scenario.number}</span>
                <h3>{scenario.title}</h3>
                <p>{scenario.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landingSection landingFaq" aria-labelledby="faq-title">
          <div className="landingSectionIntro">
            <p className="landingEyebrow">{copy.faqEyebrow}</p>
            <h2 id="faq-title">{copy.faqTitle}</h2>
          </div>
          <div className="landingFaqList">
            {copy.faqs.map((faq) => (
              <details key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <footer className="landingFooter">
        <p>VisePanda - {copy.footer}</p>
        <nav aria-label={copy.legalLabel}>
          <a href="/privacy">{copy.legal.privacy}</a>
          <a href="/terms">{copy.legal.terms}</a>
          <a href="/affiliate-disclosure">{copy.legal.affiliate}</a>
          <a href="/human-help-disclaimer">{copy.legal.humanHelp}</a>
          <a href="/emergency-disclaimer">{copy.legal.emergency}</a>
        </nav>
      </footer>
    </main>
  );
}

function ProductPreview({ copy }: Readonly<{ copy: LandingCopy }>) {
  return (
    <div className="landingPreview" aria-label={copy.preview.label}>
      <div className="landingPreviewChrome">
        <span>{copy.preview.label}</span>
        <small>{copy.preview.disclaimer}</small>
      </div>
      <div className="landingPreviewBody">
        <section className="landingCanvasPreview" aria-label={copy.preview.canvasLabel}>
          <div className="landingCanvasHeading">
            <div>
              <p>{copy.preview.canvasLabel}</p>
              <h2>{copy.preview.day}</h2>
            </div>
            <span>{copy.preview.blocks}</span>
          </div>
          <div className="landingTimeline">
            {TIMES.map((time, index) => (
              <article key={time}>
                <time>{time}</time>
                <div>
                  <h3>{copy.preview.blockTitles[index]}</h3>
                  <p>{copy.preview.blockNotes[index]}</p>
                  <ul>
                    <li>{copy.preview.tags[index]}</li>
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="landingChatPreview" aria-label={copy.preview.chatLabel}>
          <div className="landingChatHeading">
            <span aria-hidden="true">V</span>
            <div>
              <p>{copy.preview.chatLabel}</p>
              <small>{copy.preview.chatSubhead}</small>
            </div>
          </div>
          <div className="landingChatMessages">
            <p className="landingUserMessage">{copy.preview.userMessage}</p>
            <p className="landingAssistantMessage">{copy.preview.assistantMessage}</p>
          </div>
          <p className="landingPreviewState">{copy.preview.state}</p>
        </section>
      </div>
    </div>
  );
}
