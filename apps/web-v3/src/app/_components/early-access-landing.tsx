"use client";

import { landingCopyFor } from "../../i18n/landing-copy";
import { LanguageSelector } from "../../i18n/language-selector";
import { useLocale } from "../../i18n/locale-provider";
import { EarlyAccessForm } from "./early-access-form";
import { ProductPreview } from "./product-preview";

const LEGAL_BASE_URL = "https://www.go2china.space";

export function EarlyAccessLanding() {
  const { locale } = useLocale();
  const copy = landingCopyFor(locale);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-ink">
      <a
        className="absolute start-4 -top-20 z-50 rounded-brand-sm bg-brand-red px-4 py-3 font-bold text-brand-on-primary focus:top-4"
        href="#main-content"
      >
        {copy.skip}
      </a>
      <header className="border-b border-brand-gold bg-brand-surface" aria-label={copy.navLabel}>
        <div className="mx-auto flex min-h-16 max-w-screen-2xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <a
            className="text-2xl font-black tracking-normal focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-red"
            href="/"
            aria-label="VisePanda home"
          >
            <span>Vise</span>
            <span className="text-brand-red">Panda</span>
          </a>
          <LanguageSelector label={copy.languageLabel} />
        </div>
      </header>

      <main id="main-content">
        <section className="mx-auto grid max-w-screen-2xl gap-10 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-12 lg:items-start lg:px-10 lg:py-16">
          <div className="lg:col-span-5">
            <h1 className="max-w-2xl text-4xl font-black leading-tight tracking-normal text-brand-ink sm:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-brand-ink-soft">{copy.lead}</p>
            <EarlyAccessForm copy={copy} locale={locale} />
          </div>
          <div className="min-w-0 lg:col-span-7 lg:pt-2">
            <ProductPreview copy={copy} />
          </div>
        </section>

        <section
          className="border-y border-brand-line bg-brand-surface-warm"
          aria-labelledby="scenarios-title"
        >
          <div className="mx-auto max-w-screen-2xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
            <h2
              id="scenarios-title"
              className="max-w-3xl text-3xl font-black leading-tight text-brand-ink sm:text-4xl"
            >
              {copy.scenariosTitle}
            </h2>
            <div className="relative mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
              <div
                className="absolute bottom-4 start-4 top-4 w-px bg-brand-red md:start-0 md:end-0 md:top-6 md:h-px md:w-auto"
                aria-hidden="true"
              />
              {copy.scenarios.map((scenario) => (
                <article
                  key={scenario.number}
                  className="relative ps-12 md:bg-brand-surface-warm md:ps-0 md:pt-12"
                >
                  <span className="absolute start-0 top-1 grid h-8 w-8 place-items-center rounded-full border-2 border-brand-red bg-brand-surface-warm text-sm font-black text-brand-red md:top-2">
                    {scenario.number}
                  </span>
                  <h3 className="text-xl font-black text-brand-ink">{scenario.title}</h3>
                  <p className="mt-3 max-w-sm text-base leading-7 text-brand-muted">
                    {scenario.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-screen-2xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10"
          aria-labelledby="faq-title"
        >
          <h2 id="faq-title" className="text-3xl font-black text-brand-ink sm:text-4xl">
            {copy.faqTitle}
          </h2>
          <div className="mt-10 grid gap-4">
            {copy.faqs.map((faq, index) => (
              <details
                key={faq.question}
                open={index === 0}
                className="group rounded-brand-sm border border-brand-line bg-brand-surface shadow-brand-sm open:border-brand-gold"
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-lg font-bold text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red">
                  {faq.question}
                  <span className="text-xl text-brand-red group-open:hidden" aria-hidden="true">
                    +
                  </span>
                  <span
                    className="hidden text-xl text-brand-red group-open:inline"
                    aria-hidden="true"
                  >
                    −
                  </span>
                </summary>
                <p className="border-t border-brand-line px-5 py-5 text-base leading-7 text-brand-ink-soft">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-brand-gold bg-brand-surface">
        <div className="mx-auto grid max-w-screen-2xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-12 lg:items-end lg:px-10">
          <div className="lg:col-span-4">
            <p className="text-xl font-black">
              <span>Vise</span>
              <span className="text-brand-red">Panda</span>
            </p>
            <p className="mt-2 text-sm leading-6 text-brand-muted">{copy.footer}</p>
          </div>
          <nav
            className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-brand-ink-soft lg:col-span-8 lg:justify-end"
            aria-label="Legal"
          >
            <a
              className="min-h-11 content-center underline-offset-4 hover:text-brand-red hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
              href={`${LEGAL_BASE_URL}/privacy`}
            >
              {copy.legal.privacy}
            </a>
            <a
              className="min-h-11 content-center underline-offset-4 hover:text-brand-red hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
              href={`${LEGAL_BASE_URL}/terms`}
            >
              {copy.legal.terms}
            </a>
            <a
              className="min-h-11 content-center underline-offset-4 hover:text-brand-red hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
              href={`${LEGAL_BASE_URL}/affiliate-disclosure`}
            >
              {copy.legal.affiliate}
            </a>
            <a
              className="min-h-11 content-center underline-offset-4 hover:text-brand-red hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
              href={`${LEGAL_BASE_URL}/human-help-disclaimer`}
            >
              {copy.legal.humanHelp}
            </a>
            <a
              className="min-h-11 content-center underline-offset-4 hover:text-brand-red hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
              href={`${LEGAL_BASE_URL}/emergency-disclaimer`}
            >
              {copy.legal.emergency}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
