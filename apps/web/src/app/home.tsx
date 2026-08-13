import { SiteFooter, SiteHeader } from "./site-chrome";

const SCENARIO_GROUPS = [
  {
    label: "Before you fly",
    title: "Arrive prepared, not merely inspired.",
    description:
      "Turn the China-specific parts of a trip into a short, calm checklist before you land.",
    items: [
      ["Payment setup", "Understand cards, cash, and the first payment steps before departure."],
      ["Connection plan", "Choose an eSIM and keep essential travel details accessible offline."],
      ["Entry essentials", "Keep the practical documents and first-day decisions in one place."],
    ],
  },
  {
    label: "On the move",
    title: "Move through the day with less friction.",
    description:
      "A single practical surface for metro questions, places, language, and the next decision.",
    items: [
      ["Metro-friendly routes", "Ask for the simplest route, not the most impressive itinerary."],
      ["Show to Local", "Turn a clear need into something you can show at a counter or restaurant."],
      ["Place context", "See what needs booking, what is nearby, and what is worth knowing first."],
    ],
  },
  {
    label: "When plans change",
    title: "Keep moving when the trip gets real.",
    description:
      "Get a truthful next step when a payment, booking, connection, or plan stops working.",
    items: [
      ["Practical re-planning", "Ask for alternatives with the information currently available."],
      ["Clear limits", "Know when VisePanda does not have enough evidence to make a claim."],
      ["Human help, later", "A distinct assisted path is reserved for cases software should not fake."],
    ],
  },
] as const;

export function HomeShell() {
  return (
    <main className="shell homeShell">
      <SiteHeader />

      <section className="homeHero" aria-labelledby="home-title">
        <div className="homeHeroCopy">
          <p className="homeEyebrow">China Travel AI Copilot</p>
          <h1 id="home-title">China, handled.</h1>
          <p className="homeHeroLead">
            VisePanda helps you turn travel questions into practical next steps for payment,
            transport, language, tickets, and the moments when plans change.
          </p>
          <div className="heroActions">
            <a className="primaryAction" href="/visepanda">
              Start with VisePanda
            </a>
            <a className="secondaryAction" href="/explore">
              Explore places
            </a>
          </div>
          <dl className="heroProof">
            <div>
              <dt>Built for</dt>
              <dd>foreign travelers in China</dd>
            </div>
            <div>
              <dt>Designed around</dt>
              <dd>real-world travel decisions</dd>
            </div>
          </dl>
        </div>

        <ProductPreview />
      </section>

      <section className="scenarioSection" id="scenarios" aria-labelledby="scenario-title">
        <div className="sectionIntro">
          <p className="homeEyebrow">Travel situations</p>
          <h2 id="scenario-title">One travel moment at a time.</h2>
          <p>
            VisePanda groups practical support around the situations travelers actually encounter,
            rather than asking you to decode a long toolbox.
          </p>
        </div>
        <div className="scenarioStack">
          {SCENARIO_GROUPS.map((group, index) => (
            <section className="scenarioGroup" key={group.label}>
              <div className="scenarioHeading">
                <span>0{index + 1}</span>
                <p>{group.label}</p>
                <h3>{group.title}</h3>
                <small>{group.description}</small>
              </div>
              <div className="scenarioCards">
                {group.items.map(([title, description]) => (
                  <article key={title}>
                    <span aria-hidden="true">↗</span>
                    <h4>{title}</h4>
                    <p>{description}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="ecosystemSection" id="integrations" aria-labelledby="ecosystem-title">
        <div className="ecosystemCopy">
          <p className="homeEyebrow">An execution ecosystem</p>
          <h2 id="ecosystem-title">One trip, connected to the help that makes it happen.</h2>
          <p>
            VisePanda keeps planning, trusted place context, payment preparation, and human support
            as distinct layers. No hidden booking claim, no disguised recommendation.
          </p>
          <a className="textAction" href="/guides/payment">
            Read the payment guide <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className="ecosystemMap" aria-label="VisePanda ecosystem layers">
          <article>
            <span>01</span>
            <b>VisePanda</b>
            <p>Practical questions and clear limits.</p>
          </article>
          <article>
            <span>02</span>
            <b>Explore</b>
            <p>Evidence-backed place context.</p>
          </article>
          <article>
            <span>03</span>
            <b>Tools</b>
            <p>Payment, language, transport, and offline essentials.</p>
          </article>
          <article>
            <span>04</span>
            <b>Human help</b>
            <p>A separate path for work software should not pretend to do.</p>
          </article>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function ProductPreview() {
  return (
    <div className="productFrame" aria-label="Illustrative VisePanda workspace preview, not live trip data">
      <div className="productFrameBar">
        <span>Illustrative arrival example</span>
        <small>Not live trip data</small>
      </div>
      <div className="productFrameBody">
        <section className="previewPlan">
          <div className="previewSectionHeading">
            <span>Day 1</span>
            <b>Start smoothly</b>
          </div>
          <article>
            <time>09:30</time>
            <div>
              <strong>Airport to your hotel</strong>
              <span>Choose the route after your connection is live.</span>
            </div>
            <em>Transport</em>
          </article>
          <article>
            <time>12:00</time>
            <div>
              <strong>First payment setup</strong>
              <span>Keep a backup plan before your first checkout.</span>
            </div>
            <em>Payment</em>
          </article>
          <article>
            <time>18:30</time>
            <div>
              <strong>Dinner near your hotel</strong>
              <span>Show dietary needs clearly when you arrive.</span>
            </div>
            <em>Language</em>
          </article>
        </section>
        <aside className="previewCopilot">
          <span className="miniLabel">VisePanda</span>
          <p>“What is the calmest way to get from Pudong to my hotel after a long flight?”</p>
          <div className="previewAnswer">
            <b>Start with the direct route.</b>
            <span>We will help you compare metro and taxi once you know your hotel area.</span>
          </div>
          <a href="/visepanda">Continue with VisePanda</a>
        </aside>
      </div>
    </div>
  );
}
