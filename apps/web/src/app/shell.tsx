"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
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
import { useLocale } from "../i18n/locale-provider";
import type { MessageKey } from "../i18n/messages";
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

type ErrorResponse = {
  ok: false;
  error: string;
  code?: string;
  anonymousUsage?: unknown;
  retryAfterSeconds?: unknown;
};
type RequestFailureNotice = {
  kind: "rate-limit" | "model-failure" | "request-failure";
  label: string;
  title: string;
  detail: string;
  retryable: boolean;
};
type WorkspacePanel = "trip" | "chat";

const LAST_TRIP_ID_KEY = "visepanda.lastTripId";
const EXAMPLE_PROMPT_KEYS = [
  "workspace.prompt.payment",
  "workspace.prompt.metro",
  "workspace.prompt.show",
] as const;

const SAFE_CONTEXT_PROMPTS: Readonly<Record<string, string>> = {
  explore: "Help me decide what to do next from Explore.",
  guide: "Help me turn this guide into a practical next step.",
  "human-help": "What can I do myself before I request Human Help?",
  payment: "What is the safest practical next step for payment preparation?",
  trip: "Help me think through the next practical step for my trip.",
};

const LOCALIZED_CONTEXT_KEYS: Readonly<Record<string, MessageKey>> = {
  explore: "workspace.context.explore",
  guide: "workspace.context.guide",
  "human-help": "workspace.context.help",
  payment: "workspace.context.payment",
  trip: "workspace.context.trip",
};

// Retained only for the existing markup that is hidden on the dedicated workspace route.
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
      ["Clear limits", "Know when VisePanda does not have enough evidence to make a claim."],
      [
        "Human help, later",
        "A distinct assisted path is reserved for cases software should not fake.",
      ],
    ],
  },
] as const;

export function CopilotShell() {
  const { t } = useLocale();
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
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { role: "assistant", body: t("workspace.initialMessage") },
  ]);
  const [completionJob, setCompletionJob] = useState<CompletionJob | null>(null);
  const [anonymousUsage, setAnonymousUsage] = useState<AnonymousTurnUsage | null>(null);
  const [registrationGate, setRegistrationGate] = useState(false);
  const [requestFailure, setRequestFailure] = useState<RequestFailureNotice | null>(null);
  const [mobilePanel, setMobilePanel] = useState<WorkspacePanel>("chat");
  const monitorGeneration = useRef(0);
  const promptInput = useRef<HTMLInputElement>(null);
  const preflightFailureNotice = useRef<HTMLDivElement>(null);

  const isWorking = progress.status === "skeleton" || progress.status === "completing";
  const detailPassFailed = isDetailPassFailure(progress, trip);
  const registrationNotice = anonymousTurnNotice(anonymousUsage, registrationGate);
  const shouldRevealPreflightFailure =
    requestFailure !== null &&
    progress.status === "failed" &&
    !detailPassFailed &&
    !registrationGate;

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

  useEffect(() => {
    const context = new URLSearchParams(window.location.search).get("context");
    const draft = context
      ? t(LOCALIZED_CONTEXT_KEYS[context] ?? "workspace.context.trip")
      : undefined;
    if (draft) setInput((current) => current || draft);
  }, [t]);

  useEffect(() => {
    setMessages((current) =>
      current.length === 1 && current[0]?.role === "assistant" && !current[0].envelope
        ? [{ role: "assistant", body: t("workspace.initialMessage") }]
        : current,
    );
  }, [t]);

  useEffect(() => {
    if (!shouldRevealPreflightFailure) return;
    const frame = window.requestAnimationFrame(() => {
      preflightFailureNotice.current?.scrollIntoView({ block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [progress.error, shouldRevealPreflightFailure]);

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
    setRequestFailure(null);
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
          setRequestFailure(requestFailureNotice(data));
          throw new Error(data.error);
        }
        if (!data.ok && data.code === "ANONYMOUS_TURN_LIMIT_REACHED") {
          setAnonymousUsage(parseAnonymousTurnUsage(data.anonymousUsage));
          setRegistrationGate(true);
          setRequestFailure(null);
          setProgress({
            status: "failed",
            completedDays: 0,
            totalDays: 0,
            attempts: 0,
            error: data.error,
          });
          return;
        }
        if (
          !data.ok &&
          (data.code === "COPILOT_IP_RATE_LIMITED" ||
            data.code === "COPILOT_IP_RATE_LIMIT_UNAVAILABLE")
        ) {
          setRequestFailure(requestFailureNotice(data));
          setProgress({
            status: "failed",
            completedDays: 0,
            totalDays: 0,
            attempts: 0,
            error: data.error,
          });
          return;
        }
        if (data.ok) throw new Error("VisePanda request failed.");
        setRequestFailure(requestFailureNotice(data));
        throw new Error(data.error);
      }

      const envelope = CopilotEnvelopeSchema.parse(data.envelope);
      setAnonymousUsage(parseAnonymousTurnUsage(data.anonymousUsage));
      setRegistrationGate(false);
      setRequestFailure(null);
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
      setRequestFailure(
        (current) =>
          current ??
          requestFailureNotice({
            ok: false,
            error: error instanceof Error ? error.message : "VisePanda connection failed.",
          }),
      );
      setProgress({
        status: "failed",
        completedDays: 0,
        totalDays: 0,
        attempts: 1,
        error: error instanceof Error ? error.message : "VisePanda connection failed.",
      });
    }
  }

  function chooseQuestion(question: string): void {
    if (registrationGate) return;
    setInput(question);
    setMobilePanel("chat");
    window.requestAnimationFrame(() => {
      promptInput.current?.scrollIntoView({ block: "center" });
      promptInput.current?.focus();
    });
  }

  return (
    <main className="shell copilotShell viseWorkspace">
      <SiteHeader active="copilot" />

      <section className="homeHero" aria-labelledby="home-title">
        <div className="homeHeroCopy">
          <p className="homeEyebrow">China Travel AI Copilot</p>
          <h1 id="home-title">China, handled.</h1>
          <p className="homeHeroLead">
            A practical VisePanda workspace for the decisions that make a China trip feel easy:
            payment, transport, language, tickets, and the next step when plans change.
          </p>
          <div className="heroActions">
            <a className="primaryAction" href="#ask-copilot">
              Ask VisePanda
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
          aria-label="Illustrative VisePanda workspace preview, not live trip data"
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
              <span className="miniLabel">VisePanda</span>
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
            VisePanda is intentionally focused. It does not pretend to book, edit, or promise what
            it cannot verify.
          </p>
        </div>
        <div className="copilotLayout" data-mobile-panel={mobilePanel}>
          <div className="mobileWorkspaceTabs" aria-label={t("workspace.view")}>
            <button
              aria-pressed={mobilePanel === "trip"}
              onClick={() => setMobilePanel("trip")}
              type="button"
            >
              {t("workspace.trip")}
            </button>
            <button
              aria-pressed={mobilePanel === "chat"}
              onClick={() => setMobilePanel("chat")}
              type="button"
            >
              VisePanda
            </button>
          </div>
          <section className="tripCanvas" aria-label={t("workspace.tripCanvas")}>
            <div className="canvasToolbar">
              <div>
                <h1>{t("workspace.tripCanvas")}</h1>
                <span>{trip ? t("workspace.readOnlyDraft") : t("workspace.emptyTrip")}</span>
              </div>
              <span className={`conversationStatus ${progress.status}`}>
                {localizedProgressLabel(t, progress, detailPassFailed)}
              </span>
            </div>
            {trip ? (
              <TripPreview trip={trip} />
            ) : (
              <div className="tripCanvasEmpty">
                <p>{t("workspace.emptyTitle")}</p>
                <span>{t("workspace.emptyLead")}</span>
              </div>
            )}
          </section>
          <section className="conversationPanel" aria-label={t("workspace.conversation")}>
            <div className="canvasToolbar">
              <div>
                <h1>VisePanda</h1>
                <span>{t("workspace.guidance")}</span>
              </div>
              <span
                className={`conversationStatus ${registrationGate ? "accessRequired" : progress.status}`}
              >
                {registrationGate
                  ? t("workspace.signInRequired")
                  : localizedProgressLabel(t, progress, detailPassFailed)}
              </span>
            </div>
            <p className="scopeNote">{t("workspace.scope")}</p>
            <div className="railMessages">
              {messages.map((message, index) => (
                <article className={`railMessage ${message.role}`} key={`${message.role}-${index}`}>
                  <b>{message.role === "user" ? t("workspace.you") : "VisePanda"}</b>
                  {message.envelope ? (
                    <EnvelopeMessage envelope={message.envelope} trip={null} />
                  ) : (
                    <p>{message.body}</p>
                  )}
                </article>
              ))}
              {progress.status === "skeleton" ? (
                <article className="railMessage assistant typing" aria-live="polite">
                  <b>VisePanda</b>
                  <p>
                    <span aria-hidden="true">● ● ●</span> {t("workspace.thinking")}
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
                  trip={null}
                />
              ) : null}
            </div>
          </section>

          <aside className="copilotRail" aria-label={t("workspace.composer")}>
            <div className="railHeader">
              <div>
                <strong>{t("workspace.askQuestion")}</strong>
                <span>{t("workspace.askPlain")}</span>
              </div>
              <span className="previewBadge">{t("workspace.preview")}</span>
            </div>
            <div className="quickReplies" aria-label={t("workspace.examples")}>
              {EXAMPLE_PROMPT_KEYS.map((key) => {
                const prompt = t(key);
                return (
                  <button
                    disabled={registrationGate}
                    key={prompt}
                    onClick={() => chooseQuestion(prompt)}
                    type="button"
                  >
                    {prompt}
                  </button>
                );
              })}
            </div>
            {shouldRevealPreflightFailure && requestFailure ? (
              <CopilotRequestNotice
                notice={requestFailure}
                noticeRef={preflightFailureNotice}
                onRetry={requestFailure.retryable ? () => void submitPrompt({ retry: true }) : null}
              />
            ) : null}
            {registrationNotice ? (
              <div
                className={`copilotNotice account ${registrationGate ? "blocked" : "warning"}`}
                role={registrationGate ? "alert" : "status"}
              >
                <span className="copilotNoticeLabel">{t("workspace.account")}</span>
                <div>
                  <strong>{registrationNotice.title}</strong>
                  <span>{registrationNotice.detail}</span>
                </div>
                <a href="/account">{t("workspace.createAccount")}</a>
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
                placeholder={t("workspace.placeholder")}
                ref={promptInput}
                value={input}
              />
              <button disabled={!input.trim() || isWorking || registrationGate} type="submit">
                {isWorking ? t("workspace.thinkingButton") : t("workspace.ask")}
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

export function workspaceContextPrompt(context: string | null): string | undefined {
  return context ? SAFE_CONTEXT_PROMPTS[context] : undefined;
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

function localizedProgressLabel(
  translate: (key: MessageKey) => string,
  progress: GenerationProgress,
  detailPassFailed: boolean,
): string {
  if (progress.status === "idle") return translate("workspace.status.idle");
  if (progress.status === "skeleton") return translate("workspace.status.skeleton");
  if (progress.status === "completing") return translate("workspace.status.completing");
  if (progress.status === "completed") return translate("workspace.status.completed");
  if (detailPassFailed) return translate("workspace.status.attention");
  return translate("workspace.status.failed");
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
        detail: `You have used all ${usage.limit} anonymous VisePanda turns. Create an account or sign in before you continue.`,
      };
}

export function requestFailureNotice(error: ErrorResponse): RequestFailureNotice {
  if (error.code === "COPILOT_IP_RATE_LIMITED") {
    const retryAfterSeconds = positiveInteger(error.retryAfterSeconds);
    return {
      kind: "rate-limit",
      label: "Request limit",
      title: "This network has reached its VisePanda limit.",
      detail: retryAfterSeconds
        ? `Please wait ${retryAfterSeconds} seconds before asking another question.`
        : "Please wait a little before asking another question.",
      retryable: false,
    };
  }
  if (error.code === "COPILOT_IP_RATE_LIMIT_UNAVAILABLE") {
    return {
      kind: "request-failure",
      label: "Protection unavailable",
      title: "VisePanda is temporarily unavailable.",
      detail: "Request protection could not be verified. Please try again later.",
      retryable: true,
    };
  }
  if (error.code === "MODEL_CONFIGURATION_UNAVAILABLE" || error.code === "MODEL_EXECUTION_FAILED") {
    return {
      kind: "model-failure",
      label: "Model unavailable",
      title: "The VisePanda models could not respond.",
      detail: "No answer was generated or invented. Please try again in a moment.",
      retryable: true,
    };
  }
  if (error.code === "ANONYMOUS_TURN_IN_PROGRESS") {
    return {
      kind: "request-failure",
      label: "Question in progress",
      title: "Your previous question is still finishing.",
      detail: "Wait a moment before trying this question again.",
      retryable: true,
    };
  }
  return {
    kind: "request-failure",
    label: "Request failed",
    title: "VisePanda could not respond.",
    detail: error.error || "Please check your connection and try again.",
    retryable: true,
  };
}

export function CopilotRequestNotice({
  notice,
  noticeRef,
  onRetry,
}: {
  notice: RequestFailureNotice;
  noticeRef: RefObject<HTMLDivElement | null>;
  onRetry: (() => void) | null;
}) {
  return (
    <div className={`copilotNotice ${notice.kind}`} ref={noticeRef} role="alert">
      <span className="copilotNoticeLabel">{notice.label}</span>
      <div>
        <strong>{notice.title}</strong>
        <span>{notice.detail}</span>
      </div>
      {onRetry ? (
        <button onClick={onRetry} type="button">
          Try again
        </button>
      ) : null}
    </div>
  );
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function parseAnonymousTurnUsage(value: unknown): AnonymousTurnUsage | null {
  const parsed = AnonymousTurnUsageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
