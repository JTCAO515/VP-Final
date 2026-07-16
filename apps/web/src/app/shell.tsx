"use client";

import { useEffect, useState } from "react";
import {
  CopilotEnvelopeSchema,
  GenerationProgressSchema,
  TripStateSchema,
  type CopilotEnvelope,
  type GenerationProgress,
  type TripDay,
  type TripState,
} from "@visepanda/domain";

type ChatMessage = {
  role: "user" | "assistant";
  body: string;
  envelope?: CopilotEnvelope;
  trip?: TripState | null;
};

type CopilotSuccessResponse = {
  ok: true;
  envelope: unknown;
  progress: unknown;
  trip: unknown;
  version: unknown;
};

type ErrorResponse = { ok: false; error: string };

const LAST_TRIP_ID_KEY = "visepanda.lastTripId";
const EXAMPLE_PROMPTS = [
  "How do I prepare payment before arriving in China?",
  "What is the easiest way to use the metro in Shanghai?",
  "How can I show a restaurant my dietary needs?",
];

const initialMessages: ChatMessage[] = [
  {
    role: "assistant",
    body: "Tell me what you need to get done in China. I can help you think through payments, transport, language, and practical travel questions.",
  },
];

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
      [
        "Show to Local",
        "Turn a clear need into something you can show at a counter or restaurant.",
      ],
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
      ["Clear limits", "Know when the Copilot does not have enough evidence to make a claim."],
      [
        "Human help, later",
        "A distinct assisted path is reserved for cases software should not fake.",
      ],
    ],
  },
] as const;

export function CopilotShell() {
  const [input, setInput] = useState(EXAMPLE_PROMPTS[0] ?? "");
  const [progress, setProgress] = useState<GenerationProgress>({
    status: "idle",
    completedDays: 0,
    totalDays: 0,
    attempts: 0,
    error: null,
  });
  const [trip, setTrip] = useState<TripState | null>(null);
  const [tripVersion, setTripVersion] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  const isWorking = progress.status === "skeleton" || progress.status === "completing";

  useEffect(() => {
    const tripId = window.localStorage.getItem(LAST_TRIP_ID_KEY);
    if (tripId) void loadTrip(tripId);
  }, []);

  async function loadTrip(tripId: string) {
    try {
      const response = await fetch(`/api/trips/${tripId}`);
      const data = (await response.json()) as { ok: boolean; trip?: unknown; version?: unknown };
      if (!response.ok || !data.ok) return;
      setTrip(TripStateSchema.parse(data.trip));
      setTripVersion(zeroOrPositiveInteger(data.version));
    } catch {
      // A remembered anonymous Trip is optional context for a later product phase.
    }
  }

  async function submitPrompt({ retry = false }: { retry?: boolean } = {}) {
    const prompt = input.trim();
    if (!prompt || isWorking) return;

    if (!retry) {
      setMessages((current) => [...current, { role: "user", body: prompt }]);
    }
    setProgress({
      status: "skeleton",
      completedDays: 0,
      totalDays: 0,
      attempts: 0,
      error: null,
    });

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          ...(trip ? { tripId: trip.id } : {}),
          ...(trip && tripVersion !== null ? { expectedVersion: tripVersion } : {}),
        }),
      });
      const data = (await response.json()) as CopilotSuccessResponse | ErrorResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.ok ? "Copilot request failed." : data.error);
      }

      const envelope = CopilotEnvelopeSchema.parse(data.envelope);
      const nextTrip = TripStateSchema.nullable().parse(data.trip);
      const nextVersion = zeroOrPositiveInteger(data.version);
      setMessages((current) => [
        ...current,
        { role: "assistant", body: envelope.message.body, envelope, trip: nextTrip },
      ]);
      setTrip(nextTrip);
      setTripVersion(nextVersion);
      setProgress(GenerationProgressSchema.parse(data.progress));
      if (nextTrip) window.localStorage.setItem(LAST_TRIP_ID_KEY, nextTrip.id);
    } catch (error) {
      setProgress({
        status: "failed",
        completedDays: 0,
        totalDays: 0,
        attempts: 1,
        error: error instanceof Error ? error.message : "Copilot connection failed.",
      });
    }
  }

  return (
    <main className="shell copilotShell">
      <header className="copilotTopbar">
        <a className="brandMark" href="/">
          <span>V</span>
          <b>VisePanda</b>
        </a>
        <nav className="primaryNav" aria-label="Primary navigation">
          <a className="active" href="/">
            Copilot
          </a>
          <a href="#scenarios">How it helps</a>
          <a href="#integrations">Ecosystem</a>
          <a href="/account">Account</a>
        </nav>
        <div className="tripMeta">
          <span>China Travel AI Copilot</span>
          <i aria-hidden="true" />
        </div>
      </header>

      <section className="homeHero" aria-labelledby="home-title">
        <div className="homeHeroCopy">
          <p className="homeEyebrow">China Travel AI Copilot</p>
          <h1 id="home-title">China, handled.</h1>
          <p className="homeHeroLead">
            A practical Copilot for the decisions that make a China trip feel easy: payment,
            transport, language, tickets, and the next step when plans change.
          </p>
          <div className="heroActions">
            <a className="primaryAction" href="#ask-copilot">
              Ask the Copilot
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

        <div className="productFrame" aria-label="VisePanda Copilot product preview">
          <div className="productFrameBar">
            <span className="productLiveDot" aria-hidden="true" />
            <span>Shanghai arrival brief</span>
            <small>Live preview</small>
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
              <span className="miniLabel">Copilot</span>
              <p>“What is the calmest way to get from Pudong to my hotel after a long flight?”</p>
              <div className="previewAnswer">
                <b>Start with the direct route.</b>
                <span>We will help you compare metro and taxi once you know your hotel area.</span>
              </div>
              <button
                type="button"
                onClick={() => setInput("How do I get from Pudong Airport to my hotel?")}
              >
                Use this question
              </button>
            </aside>
          </div>
        </div>
      </section>

      <section
        className="copilotWorkbench"
        id="ask-copilot"
        aria-labelledby="copilot-workbench-title"
      >
        <div className="workbenchIntro">
          <div>
            <p className="homeEyebrow">Your practical starting point</p>
            <h2 id="copilot-workbench-title">Ask one clear question. Get one useful next step.</h2>
          </div>
          <p>
            The Copilot is intentionally focused. It does not pretend to book, edit, or promise what
            it cannot verify.
          </p>
        </div>
        <div className="copilotLayout">
          <section className="conversationPanel" aria-label="Copilot conversation">
            <div className="canvasToolbar">
              <div>
                <h1>Conversation</h1>
                <span>Practical China travel guidance</span>
              </div>
              <span className={`conversationStatus ${progress.status}`}>
                {progressLabel(progress)}
              </span>
            </div>
            <p className="scopeNote">
              This financing demo answers travel questions. It does not save or edit itineraries,
              book services, or connect you to a human agent.
            </p>
            <div className="railMessages">
              {messages.map((message, index) => (
                <article className={`railMessage ${message.role}`} key={`${message.role}-${index}`}>
                  <b>{message.role === "user" ? "You" : "VisePanda Copilot"}</b>
                  {message.envelope ? (
                    <EnvelopeMessage envelope={message.envelope} trip={message.trip ?? null} />
                  ) : (
                    <p>{message.body}</p>
                  )}
                </article>
              ))}
              {isWorking ? (
                <article className="railMessage assistant typing" aria-live="polite">
                  <b>VisePanda Copilot</b>
                  <p>
                    <span aria-hidden="true">● ● ●</span> Thinking through your travel question
                  </p>
                </article>
              ) : null}
            </div>
          </section>

          <aside className="copilotRail" aria-label="Copilot prompt composer">
            <div className="railHeader">
              <div>
                <strong>Start with a practical question</strong>
                <span>Ask in plain English</span>
              </div>
              <span className="online">Online</span>
            </div>
            <div className="quickReplies" aria-label="Example questions">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button key={prompt} onClick={() => setInput(prompt)} type="button">
                  {prompt}
                </button>
              ))}
            </div>
            {progress.status === "failed" ? (
              <div className="copilotFailure" role="alert">
                <strong>Copilot could not respond.</strong>
                <span>{progress.error ?? "Please check your connection and try again."}</span>
                <button onClick={() => void submitPrompt({ retry: true })} type="button">
                  Try again
                </button>
              </div>
            ) : null}
            <form
              className="railComposer"
              onSubmit={(event) => {
                event.preventDefault();
                void submitPrompt();
              }}
            >
              <input
                aria-label="Trip prompt"
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about payments, transport, language, or travel basics"
                value={input}
              />
              <button disabled={isWorking} type="submit">
                {isWorking ? "Thinking" : "Ask Copilot"}
              </button>
            </form>
          </aside>
        </div>
      </section>

      <section className="scenarioSection" id="scenarios" aria-labelledby="scenario-title">
        <div className="sectionIntro">
          <p className="homeEyebrow">Travel situations</p>
          <h2 id="scenario-title">Tools make sense when they arrive in the right moment.</h2>
          <p>
            VisePanda groups practical help around the moments travelers actually encounter, rather
            than asking you to decode a long toolbox.
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
          <h2 id="ecosystem-title">One trip, connected to the services that make it happen.</h2>
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
            <b>Copilot</b>
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

      <footer className="siteFooter">
        <a className="brandMark" href="/">
          <span>V</span>
          <b>VisePanda</b>
        </a>
        <p>China Travel AI Copilot. Practical guidance for travel decisions.</p>
        <div>
          <a href="/guides/payment">Payment guide</a>
          <a href="/human-help">Human Help</a>
          <a href="/account">Account</a>
        </div>
      </footer>
    </main>
  );
}

function EnvelopeMessage({
  envelope,
  trip,
}: {
  envelope: CopilotEnvelope;
  trip: TripState | null;
}) {
  return (
    <div className="envelopeMessage">
      <h2>{envelope.message.headline}</h2>
      <p>{envelope.message.body}</p>
      {envelope.message.highlights.length ? (
        <ul>
          {envelope.message.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      ) : null}
      {trip ? <TripPreview trip={trip} /> : null}
    </div>
  );
}

function TripPreview({ trip }: { trip: TripState }) {
  const days = previewTripDays(trip);
  if (!days.length) return null;

  return (
    <section className="tripPreview" aria-label="Read-only trip preview">
      <div className="tripPreviewHeading">
        <span>Trip preview</span>
        <small>Read-only in this demo</small>
      </div>
      <h3>{trip.title}</h3>
      <div className="tripPreviewDays">
        {days.map((day) => (
          <article className="tripPreviewDay" key={day.id}>
            <div>
              <strong>Day {day.dayNumber}</strong>
              {day.city ? <span>{day.city}</span> : null}
            </div>
            {(day.title ?? day.summary) ? <p>{day.title ?? day.summary}</p> : null}
            {day.blocks.length ? (
              <ul>
                {day.blocks.slice(0, 3).map((block) => (
                  <li key={block.id}>{block.title}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function previewTripDays(trip: TripState): TripDay[] {
  return trip.days.slice(0, 3);
}

function zeroOrPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function progressLabel(progress: GenerationProgress): string {
  if (progress.status === "idle") return "Ready";
  if (progress.status === "skeleton") return "Thinking";
  if (progress.status === "completing") return "Preparing response";
  if (progress.status === "completed") return "Ready";
  return "Connection issue";
}
