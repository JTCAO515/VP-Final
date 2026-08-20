import { EarlyAccessForm } from "./early-access-form";

const TRIP_BLOCKS = [
  {
    time: "09:30",
    title: "Morning attraction",
    note: "A calm first stop",
    tags: ["Booking may be required", "Near metro"],
  },
  {
    time: "12:30",
    title: "Lunch nearby",
    note: "Keep the route compact",
    tags: ["Chinese address available"],
  },
  {
    time: "15:00",
    title: "Afternoon museum",
    note: "An indoor option for later",
    tags: ["Better in daytime"],
  },
  {
    time: "19:00",
    title: "Evening neighborhood",
    note: "Leave room for a change of plan",
    tags: ["Plan can adapt"],
  },
] as const;

const SCENARIOS = [
  {
    number: "01",
    title: "Plan your trip",
    body: "Talk through cities, dates, pace, interests, places to include or avoid, accommodation areas, travel companions and real constraints.",
    points: [
      "Turn a conversation into a Trip Canvas, not a long text itinerary.",
      "Keep the plan visible day by day, ready to review and adjust.",
    ],
  },
  {
    number: "02",
    title: "Prepare each day",
    body: "Connect practical preparation to the particular places and days already in your Trip.",
    points: [
      "Payment, entry and booking requirements, network and transport.",
      "Chinese names and addresses when current reviewed information exists.",
    ],
  },
  {
    number: "03",
    title: "Execute and adapt",
    body: "Use the same workspace when the trip becomes real and a plan needs to change.",
    points: [
      "Translate, show to local, navigate to the next place, and reconsider timing.",
      "Find an honest recovery path when weather, availability or timing changes.",
    ],
  },
] as const;

const HOW_IT_WORKS = [
  {
    title: "Tell VisePanda about your trip",
    body: "Share your destination, dates, interests and travel pace.",
  },
  {
    title: "Review your practical itinerary",
    body: "See the trip day by day in Trip Canvas and adjust what matters.",
  },
  {
    title: "Execute with confidence",
    body: "Use practical guidance for payments, language, transport, entry and unexpected changes.",
  },
] as const;

const FAQS = [
  {
    question: "What is VisePanda?",
    answer:
      "VisePanda is an AI planning and execution workspace for independent travel in China. It combines a conversational assistant with a practical Trip Canvas.",
  },
  {
    question: "Can I try it now?",
    answer:
      "A limited product preview is available. Early Access will include expanded itinerary planning, city coverage and selected execution workflows.",
  },
  {
    question: "Which cities are supported?",
    answer:
      "Coverage is expanding city by city with carefully reviewed China travel information. The preview does not claim complete coverage for every city or task.",
  },
  {
    question: "What does Early Access include?",
    answer:
      "Early Access is designed to provide priority access to itinerary planning, Trip Canvas improvements, new city content and selected execution workflows as they become ready.",
  },
] as const;

export function EarlyAccessLanding() {
  return (
    <main className="landingPage" id="page-content">
      <a className="landingSkipLink" href="#landing-main">
        Skip to main content
      </a>
      <header className="landingNav" aria-label="VisePanda Landing">
        <a className="landingBrand" href="/" aria-label="VisePanda home">
          <span aria-hidden="true">V</span>
          <b>VisePanda</b>
        </a>
        <a className="landingJoinLink" href="#early-access">
          Join early access
        </a>
      </header>

      <div id="landing-main">
        <section className="landingHero" aria-labelledby="landing-title">
          <div className="landingHeroCopy">
            <p className="landingEyebrow">Early access for independent travelers</p>
            <h1 id="landing-title">Plan and execute your independent trip to China with AI.</h1>
            <p className="landingLead">
              VisePanda turns your travel goals into a practical itinerary, then helps you handle
              payments, language, transport, entry requirements and changes along the way.
            </p>
            <div className="landingHeroActions">
              <a className="landingPrimaryAction" href="#early-access">
                Join early access
              </a>
              <a className="landingSecondaryAction" href="/visepanda">
                Try the limited preview
              </a>
            </div>
            <a className="landingOverviewLink" href="/homepage">
              See the full product overview <span aria-hidden="true">-&gt;</span>
            </a>
          </div>
          <ProductPreview />
        </section>

        <section className="landingSection landingScenarios" aria-labelledby="scenarios-title">
          <div className="landingSectionIntro">
            <p className="landingEyebrow">One workspace, three travel moments</p>
            <h2 id="scenarios-title">Move from an idea to a day you can actually work through.</h2>
          </div>
          <div className="landingScenarioGrid">
            {SCENARIOS.map((scenario) => (
              <article key={scenario.number} className="landingScenario">
                <span>{scenario.number}</span>
                <h3>{scenario.title}</h3>
                <p>{scenario.body}</p>
                <ul>
                  {scenario.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="landingHow" aria-labelledby="how-title">
          <div className="landingHowInner">
            <div className="landingSectionIntro">
              <p className="landingEyebrow">How it works</p>
              <h2 id="how-title">A calm loop for a trip that keeps moving.</h2>
            </div>
            <ol className="landingSteps">
              {HOW_IT_WORKS.map((step, index) => (
                <li key={step.title}>
                  <span>0{index + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landingAccess" id="early-access" aria-labelledby="early-access-title">
          <div className="landingAccessCopy">
            <p className="landingEyebrow">Early access</p>
            <h2 id="early-access-title">
              Get priority access to VisePanda&apos;s itinerary planning, Trip Canvas and China
              travel execution features.
            </h2>
            <ul>
              <li>Help shape the first supported cities.</li>
              <li>Test planning and on-trip execution workflows.</li>
              <li>Share the China travel problems you want VisePanda to solve.</li>
            </ul>
          </div>
          <div className="landingFormPanel">
            <p className="landingFormKicker">Join the preview list</p>
            <EarlyAccessForm />
          </div>
        </section>

        <section className="landingSection landingFaq" aria-labelledby="faq-title">
          <div className="landingSectionIntro">
            <p className="landingEyebrow">Before you join</p>
            <h2 id="faq-title">A few honest answers.</h2>
          </div>
          <div className="landingFaqList">
            {FAQS.map((faq) => (
              <details key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <footer className="landingFooter">
        <p>VisePanda - Independent travel in China, thoughtfully prepared.</p>
        <nav aria-label="Legal">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/affiliate-disclosure">Affiliate disclosure</a>
          <a href="/human-help-disclaimer">Human Help limits</a>
          <a href="/emergency-disclaimer">Emergency disclaimer</a>
        </nav>
      </footer>
    </main>
  );
}

function ProductPreview() {
  return (
    <div className="landingPreview" aria-label="Illustrative VisePanda product preview">
      <div className="landingPreviewChrome">
        <span>Product Preview</span>
        <small>Illustrative interface - not live travel data</small>
      </div>
      <div className="landingPreviewBody">
        <section className="landingCanvasPreview" aria-label="Trip Canvas preview">
          <div className="landingCanvasHeading">
            <div>
              <p>Trip Canvas</p>
              <h2>Day 1 - Shanghai</h2>
            </div>
            <span>4 blocks</span>
          </div>
          <div className="landingTimeline">
            {TRIP_BLOCKS.map((block) => (
              <article key={block.time}>
                <time>{block.time}</time>
                <div>
                  <h3>{block.title}</h3>
                  <p>{block.note}</p>
                  <ul>
                    {block.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="landingChatPreview" aria-label="VisePanda Chatbot preview">
          <div className="landingChatHeading">
            <span aria-hidden="true">V</span>
            <div>
              <p>VisePanda</p>
              <small>Planning with context</small>
            </div>
          </div>
          <div className="landingChatMessages">
            <p className="landingUserMessage">
              I want a relaxed first day with metro-friendly stops.
            </p>
            <p className="landingAssistantMessage">
              I&apos;ve drafted a calm Day 1. Review the blocks in Trip Canvas, then we can check
              the practical preparation needed for each one.
            </p>
          </div>
          <p className="landingPreviewState">
            Static product preview. No booking or payment is taking place.
          </p>
        </section>
      </div>
    </div>
  );
}
