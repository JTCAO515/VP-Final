"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnonymousTurnUsageSchema,
  CompletionJobSchema,
  CopilotEnvelopeSchema,
  GenerationProgressSchema,
  TripStateSchema,
  type CopilotEnvelope,
  type CompletionJob,
  type GenerationProgress,
  type AnonymousTurnUsage,
  type TripDay,
  type TripState,
} from "@visepanda/domain";
import {
  COMPLETION_MAX_POLLS,
  COMPLETION_POLL_INTERVAL_MS,
  canRetryCompletion,
  clearCompletionReference,
  completionProgress,
  completionReference,
  completionStateCopy,
  readCompletionReference,
  writeCompletionReference,
  type CompletionReference,
} from "./completion-client";
import { SiteFooter, SiteHeader } from "./site-chrome";

type ChatMessage = {
  role: "user" | "assistant";
  body: string;
  envelope?: CopilotEnvelope;
  trip?: TripState | null;
};

type CopilotSuccessResponse = {
  ok: true;
  anonymousUsage: unknown;
  envelope: unknown;
  progress: unknown;
  trip: unknown;
  version: unknown;
};

type ErrorResponse = { ok: false; error: string; code?: string; anonymousUsage?: unknown };
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
  const [input, setInput] = useState("");
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
  const [completionJob, setCompletionJob] = useState<CompletionJob | null>(null);
  const [anonymousUsage, setAnonymousUsage] = useState<AnonymousTurnUsage | null>(null);
  const [registrationGate, setRegistrationGate] = useState(false);
  const monitorGeneration = useRef(0);
  const promptInput = useRef<HTMLInputElement>(null);

  const isWorking = progress.status === "skeleton" || progress.status === "completing";
  const detailPassFailed = isDetailPassFailure(progress, trip);
  const registrationNotice = anonymousTurnNotice(anonymousUsage, registrationGate);

  useEffect(() => {
    const generation = ++monitorGeneration.current;
    const reference = readCompletionReference(window.localStorage);
    const tripId = reference?.tripId ?? window.localStorage.getItem(LAST_TRIP_ID_KEY);
    void (async () => {
      const snapshot = tripId ? await loadTrip(tripId, false, generation) : null;
      if (reference) {
        await monitorCompletion(reference, generation, snapshot?.trip ?? null);
      }
    })();
    return () => {
      monitorGeneration.current += 1;
    };
  }, []);

  async function loadTrip(
    tripId: string,
    updateConversation = false,
    generation?: number,
  ): Promise<{ trip: TripState; version: number } | null> {
    try {
      const response = await fetch(`/api/trips/${tripId}`);
      const data = (await response.json()) as { ok: boolean; trip?: unknown; version?: unknown };
      if (!response.ok || !data.ok) return null;
      const loadedTrip = TripStateSchema.parse(data.trip);
      const loadedVersion = zeroOrPositiveInteger(data.version);
      if (loadedVersion === null) return null;
      if (generation !== undefined && monitorGeneration.current !== generation) return null;
      setTrip(loadedTrip);
      setTripVersion(loadedVersion);
      if (updateConversation) {
        setMessages((current) => attachTripToLatestAssistant(current, loadedTrip));
      }
      return { trip: loadedTrip, version: loadedVersion };
    } catch {
      // A remembered anonymous Trip is optional context for a later product phase.
      return null;
    }
  }

  async function monitorCompletion(
    reference: CompletionReference,
    generation: number,
    initialTrip: TripState | null,
  ): Promise<void> {
    let latestTrip = initialTrip;
    try {
      for (let poll = 0; poll < COMPLETION_MAX_POLLS; poll += 1) {
        if (monitorGeneration.current !== generation) return;
        const response = await fetch(`/api/copilot/complete?id=${reference.id}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as
          { ok: true; job: unknown } | { ok: false; error: string };
        if (monitorGeneration.current !== generation) return;
        if (!response.ok || !data.ok) {
          if (response.status === 404) clearCompletionReference(window.localStorage);
          throw new Error(data.ok ? "Completion status is unavailable." : data.error);
        }
        const job = CompletionJobSchema.parse(data.job);
        if (job.tripId !== reference.tripId || job.idempotencyKey !== reference.idempotencyKey) {
          clearCompletionReference(window.localStorage);
          throw new Error("Saved completion reference did not match the owner-scoped job.");
        }
        setCompletionJob(job);
        setProgress(completionProgress(job, latestTrip));

        if (job.state !== "queued" && job.state !== "running") {
          const snapshot = await loadTrip(reference.tripId, true, generation);
          latestTrip = snapshot?.trip ?? latestTrip;
          setProgress(completionProgress(job, latestTrip));
          if (job.state === "completed") clearCompletionReference(window.localStorage);
          return;
        }
        await delay(COMPLETION_POLL_INTERVAL_MS);
      }
      setProgress((current) => ({
        ...current,
        status: "completing",
        error: "Trip details are still processing. Refresh this page to resume checking.",
      }));
    } catch (error) {
      if (monitorGeneration.current !== generation) return;
      setProgress((current) => ({
        ...current,
        status: "failed",
        error:
          error instanceof Error ? error.message : "Completion status is temporarily unavailable.",
      }));
    }
  }

  async function startCompletion(nextTrip: TripState, nextVersion: number): Promise<void> {
    try {
      const response = await fetch("/api/copilot/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tripId: nextTrip.id, expectedVersion: nextVersion }),
      });
      const data = (await response.json()) as
        { ok: true; job: unknown } | { ok: false; error: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.ok ? "Trip completion could not be queued." : data.error);
      }
      const job = CompletionJobSchema.parse(data.job);
      const reference = completionReference(job);
      writeCompletionReference(window.localStorage, reference);
      setCompletionJob(job);
      setProgress(completionProgress(job, nextTrip));
      const generation = ++monitorGeneration.current;
      await monitorCompletion(reference, generation, nextTrip);
    } catch (error) {
      setProgress((current) => ({
        ...current,
        status: "failed",
        error: error instanceof Error ? error.message : "Trip completion could not be queued.",
      }));
    }
  }

  async function retryCompletion(): Promise<void> {
    const reference = readCompletionReference(window.localStorage);
    if (!reference || !completionJob || !canRetryCompletion(completionJob)) return;
    try {
      const response = await fetch("/api/copilot/complete", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: reference.id, idempotencyKey: reference.idempotencyKey }),
      });
      const data = (await response.json()) as
        { ok: true; job: unknown } | { ok: false; error: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.ok ? "Completion cannot be retried." : data.error);
      }
      const job = CompletionJobSchema.parse(data.job);
      setCompletionJob(job);
      setProgress(completionProgress(job, trip));
      const generation = ++monitorGeneration.current;
      await monitorCompletion(reference, generation, trip);
    } catch (error) {
      setProgress((current) => ({
        ...current,
        status: "failed",
        error: error instanceof Error ? error.message : "Completion retry is unavailable.",
      }));
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
        if (!data.ok && data.code === "ANONYMOUS_TURN_IN_PROGRESS") {
          setAnonymousUsage(parseAnonymousTurnUsage(data.anonymousUsage));
          setRegistrationGate(false);
          throw new Error(data.error);
        }
        if (!data.ok && data.code === "ANONYMOUS_TURN_LIMIT_REACHED") {
          setAnonymousUsage(parseAnonymousTurnUsage(data.anonymousUsage));
          setRegistrationGate(true);
          setProgress({
            status: "failed",
            completedDays: 0,
            totalDays: 0,
            attempts: 0,
            error: data.error,
          });
          return;
        }
        throw new Error(data.ok ? "Copilot request failed." : data.error);
      }

      const envelope = CopilotEnvelopeSchema.parse(data.envelope);
      setAnonymousUsage(parseAnonymousTurnUsage(data.anonymousUsage));
      setRegistrationGate(false);
      const nextTrip = TripStateSchema.nullable().parse(data.trip);
      const nextVersion = zeroOrPositiveInteger(data.version);
      setMessages((current) => [
        ...current,
        { role: "assistant", body: envelope.message.body, envelope, trip: nextTrip },
      ]);
      monitorGeneration.current += 1;
      clearCompletionReference(window.localStorage);
      setCompletionJob(null);
      setTrip(nextTrip);
      setTripVersion(nextVersion);
      const nextProgress = GenerationProgressSchema.parse(data.progress);
      setProgress(nextProgress);
      if (nextTrip) window.localStorage.setItem(LAST_TRIP_ID_KEY, nextTrip.id);
      if (nextProgress.status === "skeleton") {
        if (nextTrip && nextVersion !== null) void startCompletion(nextTrip, nextVersion);
        else {
          setProgress({
            ...nextProgress,
            status: "failed",
            error: "The trip skeleton could not be linked to durable completion.",
          });
        }
      }
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

  function chooseQuestion(question: string): void {
    if (registrationGate) return;
    setInput(question);
    window.requestAnimationFrame(() => {
      promptInput.current?.scrollIntoView({ block: "center" });
      promptInput.current?.focus();
    });
  }

  return (
    <main className="shell copilotShell">
      <SiteHeader active="copilot" />

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

        <div
          className="productFrame"
          aria-label="Illustrative VisePanda Copilot preview, not live trip data"
        >
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
              <span className="miniLabel">Copilot</span>
              <p>“What is the calmest way to get from Pudong to my hotel after a long flight?”</p>
              <div className="previewAnswer">
                <b>Start with the direct route.</b>
                <span>We will help you compare metro and taxi once you know your hotel area.</span>
              </div>
              <button
                type="button"
                onClick={() => chooseQuestion("How do I get from Pudong Airport to my hotel?")}
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
              <span
                className={`conversationStatus ${registrationGate ? "accessRequired" : progress.status}`}
              >
                {registrationGate ? "Sign in required" : progressLabel(progress, detailPassFailed)}
              </span>
            </div>
            <p className="scopeNote">
              This preview answers travel questions and can draft a read-only Trip preview. It does
              not edit itineraries, book services, or connect you to a human agent.
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
              {progress.status === "skeleton" ? (
                <article className="railMessage assistant typing" aria-live="polite">
                  <b>VisePanda Copilot</b>
                  <p>
                    <span aria-hidden="true">● ● ●</span> Thinking through your travel question
                  </p>
                </article>
              ) : null}
              {completionJob || trip ? (
                <CompletionStatusCard
                  job={completionJob}
                  progress={progress}
                  retry={
                    completionJob && canRetryCompletion(completionJob)
                      ? () => void retryCompletion()
                      : null
                  }
                  trip={
                    trip && !messages.some((message) => message.trip?.id === trip.id) ? trip : null
                  }
                />
              ) : null}
            </div>
          </section>

          <aside className="copilotRail" aria-label="Copilot prompt composer">
            <div className="railHeader">
              <div>
                <strong>Start with a practical question</strong>
                <span>Ask in plain English</span>
              </div>
              <span className="previewBadge">Preview</span>
            </div>
            <div className="quickReplies" aria-label="Example questions">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  disabled={registrationGate}
                  key={prompt}
                  onClick={() => chooseQuestion(prompt)}
                  type="button"
                >
                  {prompt}
                </button>
              ))}
            </div>
            {progress.status === "failed" && !detailPassFailed && !registrationGate ? (
              <div className="copilotFailure" role="alert">
                <strong>Copilot could not respond.</strong>
                <span>{progress.error ?? "Please check your connection and try again."}</span>
                <button onClick={() => void submitPrompt({ retry: true })} type="button">
                  Try again
                </button>
              </div>
            ) : null}
            {registrationNotice ? (
              <div
                className={`registrationNotice ${registrationGate ? "blocked" : "warning"}`}
                role={registrationGate ? "alert" : "status"}
              >
                <div>
                  <strong>{registrationNotice.title}</strong>
                  <span>{registrationNotice.detail}</span>
                </div>
                <a href="/account">Create account or sign in</a>
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
                disabled={registrationGate}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about payments, transport, language, or travel basics"
                ref={promptInput}
                value={input}
              />
              <button disabled={!input.trim() || isWorking || registrationGate} type="submit">
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

      <SiteFooter />
    </main>
  );
}

function CompletionStatusCard({
  job,
  progress,
  retry,
  trip,
}: {
  job: CompletionJob | null;
  progress: GenerationProgress;
  retry: (() => void) | null;
  trip: TripState | null;
}) {
  const copy = job
    ? completionStateCopy(job)
    : progress.status === "failed"
      ? {
          title: "Trip details unavailable",
          detail: "Your trip skeleton is safe, but the detail pass could not start.",
        }
      : { title: "Saved trip", detail: "Your latest owner-scoped trip is available below." };
  return (
    <section className={`completionStatusCard ${job?.state ?? "saved"}`} aria-live="polite">
      <div className="completionStatusHeading">
        <div>
          <span>Trip detail status</span>
          <h3>{copy.title}</h3>
        </div>
        {job ? <b>{job.state}</b> : null}
      </div>
      <p>{progress.error ?? copy.detail}</p>
      {job ? (
        <small>
          Attempt {job.attempt} of {job.maxAttempts}
        </small>
      ) : null}
      {retry ? (
        <button onClick={retry} type="button">
          Retry detail pass
        </button>
      ) : null}
      {trip ? <TripPreview trip={trip} /> : null}
    </section>
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

export function attachTripToLatestAssistant(
  messages: ChatMessage[],
  nextTrip: TripState,
): ChatMessage[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant" || !message.envelope) continue;
    return messages.map((item, itemIndex) =>
      itemIndex === index ? { ...item, trip: nextTrip } : item,
    );
  }
  return messages;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function zeroOrPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function isDetailPassFailure(progress: GenerationProgress, trip: TripState | null): boolean {
  return progress.status === "failed" && trip !== null && progress.totalDays > 0;
}

export function progressLabel(progress: GenerationProgress, detailPassFailed: boolean): string {
  if (progress.status === "idle") return "No request yet";
  if (progress.status === "skeleton") return "Request in progress";
  if (progress.status === "completing") return "Trip details in progress";
  if (progress.status === "completed") return "Answer received";
  if (detailPassFailed) return "Details need attention";
  return "Request failed";
}

export function anonymousTurnNotice(
  usage: AnonymousTurnUsage | null,
  blocked: boolean,
): { title: string; detail: string } | null {
  if (blocked && !usage) {
    return {
      title: "Sign in to continue.",
      detail: "This anonymous question was blocked before it reached a model.",
    };
  }
  if (!usage || usage.remaining > 0) return null;
  return blocked
    ? {
        title: "Your anonymous preview is complete.",
        detail:
          "Create an account or sign in before asking another question. Your blocked question was not sent to a model.",
      }
    : {
        title: "Your next question needs an account.",
        detail: `You have used all ${usage.limit} anonymous Copilot turns. Create an account or sign in before you continue.`,
      };
}

function parseAnonymousTurnUsage(value: unknown): AnonymousTurnUsage | null {
  const parsed = AnonymousTurnUsageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
