"use client";

import { useLocale } from "../i18n/locale-provider";
import { SiteFooter, SiteHeader } from "./site-chrome";

const SCENARIO_GROUPS = [
  {
    label: "home.before.label",
    title: "home.before.title",
    description: "home.before.description",
    items: [
      ["home.before.payment.title", "home.before.payment.description"],
      ["home.before.connection.title", "home.before.connection.description"],
      ["home.before.entry.title", "home.before.entry.description"],
    ],
  },
  {
    label: "home.move.label",
    title: "home.move.title",
    description: "home.move.description",
    items: [
      ["home.move.metro.title", "home.move.metro.description"],
      ["home.move.show.title", "home.move.show.description"],
      ["home.move.places.title", "home.move.places.description"],
    ],
  },
  {
    label: "home.change.label",
    title: "home.change.title",
    description: "home.change.description",
    items: [
      ["home.change.replan.title", "home.change.replan.description"],
      ["home.change.limits.title", "home.change.limits.description"],
      ["home.change.help.title", "home.change.help.description"],
    ],
  },
] as const;

export function HomeShell() {
  const { t } = useLocale();

  return (
    <main className="shell homeShell">
      <SiteHeader />

      <section className="homeHero" aria-labelledby="home-title">
        <div className="homeHeroCopy">
          <p className="homeEyebrow">{t("home.eyebrow")}</p>
          <h1 id="home-title">{t("home.title")}</h1>
          <p className="homeHeroLead">{t("home.lead")}</p>
          <div className="heroActions">
            <a className="primaryAction" href="/visepanda">
              {t("home.start")}
            </a>
            <a className="secondaryAction" href="/explore">
              {t("home.explore")}
            </a>
          </div>
          <dl className="heroProof">
            <div>
              <dt>{t("home.builtFor")}</dt>
              <dd>{t("home.builtForValue")}</dd>
            </div>
            <div>
              <dt>{t("home.designedAround")}</dt>
              <dd>{t("home.designedAroundValue")}</dd>
            </div>
          </dl>
        </div>

        <ProductPreview />
      </section>

      <section className="scenarioSection" id="scenarios" aria-labelledby="scenario-title">
        <div className="sectionIntro">
          <p className="homeEyebrow">{t("home.situationsEyebrow")}</p>
          <h2 id="scenario-title">{t("home.situationsTitle")}</h2>
          <p>{t("home.situationsLead")}</p>
        </div>
        <div className="scenarioStack">
          {SCENARIO_GROUPS.map((group, index) => (
            <section className="scenarioGroup" key={group.label}>
              <div className="scenarioHeading">
                <span>0{index + 1}</span>
                <p>{t(group.label)}</p>
                <h3>{t(group.title)}</h3>
                <small>{t(group.description)}</small>
              </div>
              <div className="scenarioCards">
                {group.items.map(([title, description]) => (
                  <article key={title}>
                    <span aria-hidden="true">↗</span>
                    <h4>{t(title)}</h4>
                    <p>{t(description)}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="ecosystemSection" id="integrations" aria-labelledby="ecosystem-title">
        <div className="ecosystemCopy">
          <p className="homeEyebrow">{t("home.ecosystem.eyebrow")}</p>
          <h2 id="ecosystem-title">{t("home.ecosystem.title")}</h2>
          <p>{t("home.ecosystem.lead")}</p>
          <a className="textAction" href="/guides/payment">
            {t("home.ecosystem.action")} <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className="ecosystemMap" aria-label="VisePanda ecosystem layers">
          <article>
            <span>01</span>
            <b>VisePanda</b>
            <p>{t("home.ecosystem.visepanda")}</p>
          </article>
          <article>
            <span>02</span>
            <b>{t("nav.explore")}</b>
            <p>{t("home.ecosystem.explore")}</p>
          </article>
          <article>
            <span>03</span>
            <b>Tools</b>
            <p>{t("home.ecosystem.tools")}</p>
          </article>
          <article>
            <span>04</span>
            <b>{t("nav.humanHelp")}</b>
            <p>{t("home.ecosystem.help")}</p>
          </article>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function ProductPreview() {
  const { t } = useLocale();

  return (
    <div
      className="productFrame"
      aria-label={`${t("home.preview.label")}: ${t("home.preview.disclaimer")}`}
    >
      <div className="productFrameBar">
        <span>{t("home.preview.label")}</span>
        <small>{t("home.preview.disclaimer")}</small>
      </div>
      <div className="productFrameBody">
        <section className="previewPlan">
          <div className="previewSectionHeading">
            <span>{t("home.preview.day")}</span>
            <b>{t("home.preview.start")}</b>
          </div>
          <article>
            <time>09:30</time>
            <div>
              <strong>{t("home.preview.transport.title")}</strong>
              <span>{t("home.preview.transport.description")}</span>
            </div>
            <em>{t("home.preview.transport.tag")}</em>
          </article>
          <article>
            <time>12:00</time>
            <div>
              <strong>{t("home.preview.payment.title")}</strong>
              <span>{t("home.preview.payment.description")}</span>
            </div>
            <em>{t("home.preview.payment.tag")}</em>
          </article>
          <article>
            <time>18:30</time>
            <div>
              <strong>{t("home.preview.dinner.title")}</strong>
              <span>{t("home.preview.dinner.description")}</span>
            </div>
            <em>{t("home.preview.dinner.tag")}</em>
          </article>
        </section>
        <aside className="previewCopilot">
          <span className="miniLabel">VisePanda</span>
          <p>“{t("home.preview.question")}”</p>
          <div className="previewAnswer">
            <b>{t("home.preview.answerTitle")}</b>
            <span>{t("home.preview.answer")}</span>
          </div>
          <a href="/visepanda">{t("home.preview.continue")}</a>
        </aside>
      </div>
    </div>
  );
}
