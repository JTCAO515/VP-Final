"use client";

import { useEffect, useMemo, useState } from "react";
import {
  applyPatch,
  CopilotEnvelopeSchema,
  GenerationProgressSchema,
  TripStateSchema,
  type CopilotEnvelope,
  type GenerationProgress,
  type TripBlock,
  type TripState,
} from "@visepanda/domain";

type ChatMessage = {
  role: "user" | "assistant";
  body: string;
  envelope?: CopilotEnvelope;
};

type CopilotSuccessResponse = {
  ok: true;
  envelope: unknown;
  progress: unknown;
  trip: unknown;
};

type CompleteSuccessResponse = {
  ok: true;
  progress: unknown;
  trip: unknown;
};

type ErrorResponse = {
  ok: false;
  error: string;
};

const ANON_ID_KEY = "visepanda.anonId";
const LAST_TRIP_ID_KEY = "visepanda.lastTripId";
const AUTH_USER_ID_KEY = "visepanda.auth.userId";
const AUTH_EMAIL_KEY = "visepanda.auth.email";

const fallbackSkeletonEnvelope = CopilotEnvelopeSchema.parse({
  intent: "trip_create",
  message: {
    headline: "Shanghai skeleton ready",
    body: "I drafted the trip shell first. Details are filling in next.",
    highlights: ["Skeleton first", "Details pending"],
  },
  tripActions: [
    {
      operations: [
        {
          op: "create_trip",
          trip: {
            id: "08fc00bc-89f0-48c7-8cb6-a13d0e4f4c60",
            title: "Shanghai first-timer",
            destinationCountry: "CN",
            startDate: "2026-07-14",
            endDate: "2026-07-16",
            days: [
              { id: "day-1", dayNumber: 1, city: "Shanghai", title: "Arrival", blocks: [] },
              { id: "day-2", dayNumber: 2, city: "Shanghai", title: "Old town", blocks: [] },
              { id: "day-3", dayNumber: 3, city: "Shanghai", title: "Skyline", blocks: [] },
            ],
          },
        },
      ],
    },
  ],
  toolCards: [
    {
      id: "tool-payment-basics",
      kind: "payment",
      title: "Payment prep",
      body: "Set up Alipay or WeChat Pay before landing.",
    },
  ],
});

const fallbackDetailedEnvelope = CopilotEnvelopeSchema.parse({
  intent: "trip_edit",
  message: {
    headline: "Details added",
    body: "I filled the skeleton with practical blocks you can review on the canvas.",
    highlights: ["Yu Garden morning", "Metro-friendly flow"],
  },
  tripActions: [
    {
      operations: [
        {
          op: "upsert_block",
          dayNumber: 1,
          block: {
            id: "block-arrival",
            type: "transport",
            title: "Arrive and check in",
            description: "Keep the first day light after landing.",
            status: "ready",
          },
        },
        {
          op: "upsert_block",
          dayNumber: 2,
          block: {
            id: "block-yu-garden",
            type: "attraction",
            title: "Yu Garden",
            description: "Walk the old town before lunch.",
            startTime: "09:00",
            address: "279 Yuyuan Old St",
            status: "planned",
            metadata: {
              alert: "Tickets selling fast today — book before you go.",
              tags: ["Booking Required", "Near Metro L10"],
              actions: ["Book Ticket", "Show to Local"],
            },
          },
        },
      ],
    },
  ],
});

const demoTrip = applyEnvelope(
  applyEnvelope(null, fallbackSkeletonEnvelope),
  fallbackDetailedEnvelope,
);

const initialMessages: ChatMessage[] = [
  {
    role: "assistant",
    body: "Good morning! It is Day 2 in Shanghai. Yu Garden tickets are going fast — want me to help you plan around payment, metro, and tickets?",
  },
];

export function CopilotShell() {
  const [anonId, setAnonId] = useState<string | null>(null);
  const [input, setInput] = useState(
    "Plan my first 2 days in Shanghai with payment and metro tips",
  );
  const [progress, setProgress] = useState<GenerationProgress>({
    status: "idle",
    completedDays: 0,
    totalDays: 0,
    attempts: 0,
    error: null,
  });
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [trip, setTrip] = useState<TripState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const displayTrip = trip ?? demoTrip;
  const selectedDay = displayTrip?.days[selectedDayIndex] ?? displayTrip?.days[0] ?? null;
  const isWorking = progress.status === "skeleton" || progress.status === "completing";
  const useMockFallback = process.env.NEXT_PUBLIC_COPILOT_MOCK === "1";

  const readiness = useMemo(() => {
    const blocks = displayTrip?.days.flatMap((day) => day.blocks) ?? [];
    if (blocks.length === 0) return 0;
    const ready = blocks.filter((block) => block.status === "ready" || block.status === "done");
    return Math.round((ready.length / blocks.length) * 100);
  }, [displayTrip]);

  useEffect(() => {
    const nextAnonId = ensureAnonId();
    setAnonId(nextAnonId);

    const storedUserId = window.localStorage.getItem(AUTH_USER_ID_KEY);
    const storedEmail = window.localStorage.getItem(AUTH_EMAIL_KEY);
    const tripId = window.localStorage.getItem(LAST_TRIP_ID_KEY);
    if (tripId) {
      void loadTrip(tripId, {
        anonId: nextAnonId,
        ...(storedUserId ? { userId: storedUserId } : {}),
      });
    }

    if (storedUserId) {
      void claimAnonymousTrips({
        anonId: nextAnonId,
        userId: storedUserId,
        ...(storedEmail ? { email: storedEmail } : {}),
      });
    }

    function handleAuthSession(event: Event) {
      const detail = (event as CustomEvent<{ userId?: string; email?: string }>).detail;
      if (!detail?.userId) return;
      window.localStorage.setItem(AUTH_USER_ID_KEY, detail.userId);
      if (detail.email) window.localStorage.setItem(AUTH_EMAIL_KEY, detail.email);
      void claimAnonymousTrips({
        anonId: nextAnonId,
        userId: detail.userId,
        ...(detail.email ? { email: detail.email } : {}),
      });
    }

    window.addEventListener("visepanda:supabase-auth", handleAuthSession);
    return () => window.removeEventListener("visepanda:supabase-auth", handleAuthSession);
  }, []);

  useEffect(() => {
    if (!displayTrip || selectedDayIndex < displayTrip.days.length) return;
    setSelectedDayIndex(Math.max(0, displayTrip.days.length - 1));
  }, [displayTrip, selectedDayIndex]);

  async function loadTrip(tripId: string, owner: { anonId?: string; userId?: string }) {
    if (!owner.anonId && !owner.userId) return;
    try {
      const params = new URLSearchParams();
      if (owner.anonId) params.set("anonId", owner.anonId);
      if (owner.userId) params.set("userId", owner.userId);
      const response = await fetch(`/api/trips/${tripId}?${params.toString()}`);
      const data = (await response.json()) as { ok: boolean; trip?: unknown };
      if (!response.ok || !data.ok) return;
      setTrip(TripStateSchema.parse(data.trip));
    } catch {
      // Loading a saved anonymous trip is a convenience; the composer still works if it fails.
    }
  }

  async function submitPrompt() {
    const prompt = input.trim();
    if (!prompt || isWorking) return;

    if (useMockFallback) {
      runMockFlow(prompt);
      return;
    }

    const ownerAnonId = anonId ?? ensureAnonId();
    if (!anonId) setAnonId(ownerAnonId);
    const tripId = trip?.id ?? crypto.randomUUID();
    setMessages((current) => [...current, { role: "user", body: prompt }]);
    setProgress({
      status: "skeleton",
      completedDays: 0,
      totalDays: trip?.days.length ?? 0,
      attempts: 0,
      error: null,
    });

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          tripId,
          anonId: ownerAnonId,
          currentTrip: trip,
        }),
      });
      const data = (await response.json()) as CopilotSuccessResponse | ErrorResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.ok ? "Copilot request failed." : data.error);
      }

      const envelope = CopilotEnvelopeSchema.parse(data.envelope);
      const nextTrip = TripStateSchema.nullable().parse(data.trip);
      const nextProgress = GenerationProgressSchema.parse(data.progress);
      setMessages((current) => [
        ...current,
        { role: "assistant", body: envelope.message.body, envelope },
      ]);
      setTrip(nextTrip);
      setProgress(nextProgress);
      if (nextTrip) window.localStorage.setItem(LAST_TRIP_ID_KEY, nextTrip.id);

      if (nextTrip?.days.some((day) => day.blocks.length === 0)) {
        await completeTrip(nextTrip.id, ownerAnonId).catch((error: unknown) => {
          setProgress((current) => ({
            ...current,
            status: "failed",
            error: error instanceof Error ? error.message : "Trip completion failed.",
          }));
        });
      }
    } catch (error) {
      setProgress({
        status: "failed",
        completedDays: 0,
        totalDays: trip?.days.length ?? 0,
        attempts: 1,
        error: error instanceof Error ? error.message : "Copilot connection failed.",
      });
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          body: "I could not connect to the Copilot service. Please retry in a moment.",
        },
      ]);
    }
  }

  async function completeTrip(tripId: string, ownerAnonId: string) {
    setProgress((current) => ({
      ...current,
      status: "completing",
      attempts: current.attempts + 1,
    }));

    const response = await fetch("/api/copilot/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tripId, anonId: ownerAnonId }),
    });
    const data = (await response.json()) as CompleteSuccessResponse | ErrorResponse;
    if (!response.ok || !data.ok) {
      throw new Error(data.ok ? "Trip completion failed." : data.error);
    }

    const nextTrip = TripStateSchema.nullable().parse(data.trip);
    setProgress(GenerationProgressSchema.parse(data.progress));
    setTrip(nextTrip);
    if (nextTrip) window.localStorage.setItem(LAST_TRIP_ID_KEY, nextTrip.id);
  }

  function runMockFlow(prompt: string) {
    const skeletonTrip = applyEnvelope(null, fallbackSkeletonEnvelope);
    setMessages([
      ...messages,
      { role: "user", body: prompt },
      {
        role: "assistant",
        body: fallbackSkeletonEnvelope.message.body,
        envelope: fallbackSkeletonEnvelope,
      },
    ]);
    setTrip(skeletonTrip);
    setProgress({
      status: "skeleton",
      completedDays: 0,
      totalDays: skeletonTrip?.days.length ?? 0,
      attempts: 0,
      error: null,
    });

    window.setTimeout(() => {
      setTrip((current) => applyEnvelope(current, fallbackDetailedEnvelope));
      setProgress((current) => ({
        ...current,
        status: "completed",
        completedDays: current.totalDays,
        attempts: current.attempts + 1,
      }));
    }, 700);
  }

  async function claimAnonymousTrips({
    anonId: ownerAnonId,
    userId,
    email,
  }: {
    anonId: string;
    userId: string;
    email?: string;
  }) {
    const response = await fetch("/api/trips/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ anonId: ownerAnonId, userId, email }),
    });
    const data = (await response.json()) as { ok: boolean; trips?: unknown[] };
    if (!response.ok || !data.ok || !data.trips?.[0]) return;
    const claimedTrip = TripStateSchema.parse(data.trips[0]);
    setTrip(claimedTrip);
    window.localStorage.setItem(LAST_TRIP_ID_KEY, claimedTrip.id);
  }

  async function shareTrip() {
    if (!trip) return;
    setShareError(null);
    const ownerAnonId = anonId ?? ensureAnonId();
    const storedUserId = window.localStorage.getItem(AUTH_USER_ID_KEY);
    const response = await fetch(`/api/trips/${trip.id}/share`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        anonId: ownerAnonId,
        ...(storedUserId ? { userId: storedUserId } : {}),
      }),
    });
    const data = (await response.json()) as { ok: boolean; url?: string; error?: string };
    if (!response.ok || !data.ok || !data.url) {
      setShareError(data.error ?? "Could not create a share link.");
      return;
    }
    setShareUrl(new URL(data.url, window.location.origin).toString());
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
          <a href="/explore">Explore</a>
          <a href="/guides/payment">Tools</a>
          <a href="/human-help">Help</a>
          <a href="/account">Account</a>
        </nav>
        <div className="tripMeta">
          <span>
            {displayTrip ? `${displayTrip.title} · ${displayTrip.days.length} Days` : "Ready"}
          </span>
          <i aria-hidden="true" />
        </div>
      </header>

      <section className="copilotLayout">
        <div className="tripCanvas">
          <div className="canvasToolbar">
            <div>
              <h1>Trip Canvas</h1>
              <span>{displayTrip ? `${displayTrip.days.length} days planned` : "No trip yet"}</span>
            </div>
            <div className="toolbarActions">
              <span className="readiness">Readiness {readiness}%</span>
              <button disabled={!trip} onClick={() => void shareTrip()} type="button">
                Share
              </button>
              <button type="button">Add Block</button>
            </div>
          </div>
          {shareUrl || shareError ? (
            <div className={shareUrl ? "shareNotice" : "shareNotice error"}>
              {shareUrl ? (
                <>
                  <span>Read-only share link ready</span>
                  <a href={shareUrl}>{shareUrl}</a>
                </>
              ) : (
                <span>{shareError}</span>
              )}
            </div>
          ) : null}

          <div className="dayTabs" aria-label="Trip days">
            {displayTrip?.days.map((day, index) => (
              <button
                className={index === selectedDayIndex ? "selected" : ""}
                key={day.id}
                onClick={() => setSelectedDayIndex(index)}
                type="button"
              >
                Day {day.dayNumber}
                <span>{day.city ?? "China"}</span>
              </button>
            ))}
            <button type="button">+ Day</button>
          </div>

          <section className="dayStage">
            <div className="dayHeading">
              <div>
                <h2>
                  {selectedDay
                    ? `Day ${selectedDay.dayNumber} · ${selectedDay.title ?? "Plan"}`
                    : "No day selected"}
                </h2>
                <p>
                  {selectedDay?.city ?? "China"} · {selectedDay?.blocks.length ?? 0} activities
                </p>
              </div>
              <div className="dayStepper" aria-hidden="true">
                <span>‹</span>
                <span>›</span>
              </div>
            </div>

            <div className="timeline">
              {selectedDay?.blocks.length ? (
                selectedDay.blocks.map((block) => <ActivityCard block={block} key={block.id} />)
              ) : (
                <article className="activityCard">
                  <div className="activityHeader">
                    <div>
                      <h3>Details are being prepared</h3>
                      <p>Ask Copilot to fill this day with execution-ready blocks.</p>
                    </div>
                  </div>
                  <div className="activityTags">
                    <span>{progressLabel(progress)}</span>
                  </div>
                </article>
              )}
            </div>
          </section>
        </div>

        <aside className="copilotRail" aria-label="Copilot conversation">
          <div className="railHeader">
            <div>
              <strong>Copilot</strong>
              <span>{progressLabel(progress)}</span>
            </div>
            <span className="online">Online</span>
          </div>

          <div className="railMessages">
            {messages.map((message, index) => (
              <article className={`railMessage ${message.role}`} key={`${message.role}-${index}`}>
                <b>{message.role === "user" ? "You" : "Copilot"}</b>
                <p>{message.body}</p>
                {message.envelope ? <MessageEnhancements envelope={message.envelope} /> : null}
              </article>
            ))}
          </div>

          <div className="quickReplies">
            <button type="button">Book all tickets</button>
            <button type="button">Optimize today</button>
            <button type="button">Human help</button>
          </div>

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
              placeholder="Ask anything about your trip..."
              value={input}
            />
            <button disabled={isWorking} type="submit">
              {isWorking ? "Working" : "Send"}
            </button>
          </form>
        </aside>
      </section>
    </main>
  );
}

function MessageEnhancements({ envelope }: { envelope: CopilotEnvelope }) {
  const toolCards = envelope.toolCards;
  const citations = envelope.citations.slice(0, 3);
  const commercialActions =
    envelope.intent === "commerce_intent"
      ? envelope.commercialActions.filter((action) => action.url)
      : [];

  if (envelope.intent !== "commerce_intent" && envelope.commercialActions.length > 0) {
    console.warn("Dropped commercialActions outside commerce_intent", envelope.commercialActions);
  }

  return (
    <>
      {toolCards.map((card) => (
        <div className="toolCard railToolCard" key={card.id}>
          <b>{card.title}</b>
          <span>{card.body}</span>
          <a href={toolCardHref(card.kind)}>{toolCardCta(card.kind)}</a>
        </div>
      ))}

      {commercialActions.length ? (
        <div className="commercialActions">
          <span>Affiliate disclosure: VisePanda may earn a commission from partner links.</span>
          {commercialActions.map((action) => (
            <a href={commercialActionHref(action)} key={action.id}>
              {action.label}
              <small>{action.disclosure}</small>
            </a>
          ))}
        </div>
      ) : null}

      {envelope.humanHelp ? (
        <a className="humanHelpCta" href={humanHelpHref(envelope.humanHelp)}>
          Send to Human Help
        </a>
      ) : null}

      {citations.length ? (
        <div className="citations">
          <span>Sources</span>
          {citations.map((citation) => {
            const href = citationHref(citation.fact_id);
            const label = citation.label ?? citation.fact_id;
            return href ? (
              <a href={href} key={citation.fact_id}>
                {label}
                <small>{citation.source ?? citation.fact_id}</small>
              </a>
            ) : (
              <span key={citation.fact_id}>
                {label}
                <small>{citation.source ?? citation.fact_id}</small>
              </span>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

function ActivityCard({ block }: { block: TripBlock }) {
  const metadata = block.metadata ?? {};
  const tags = readStringArray(metadata.tags);
  const actions = readStringArray(metadata.actions);
  const alert = typeof metadata.alert === "string" ? metadata.alert : null;

  return (
    <article className={`activityCard ${block.status === "needs_attention" ? "urgent" : ""}`}>
      <div className="timelineDot" aria-hidden="true" />
      <div className="activityHeader">
        <div>
          <h3>{block.title}</h3>
          <p>{block.description ?? block.address ?? "Execution details pending"}</p>
        </div>
        {block.startTime ? <time>{block.startTime}</time> : null}
      </div>
      {alert ? <div className="activityAlert">{alert}</div> : null}
      <div className="activityTags">
        {block.status ? <span>{statusLabel(block.status)}</span> : null}
        {block.address ? <span>Address ready</span> : null}
        {tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="activityActions">
        {(actions.length > 0 ? actions : defaultActions(block)).map((action) => (
          <button className={action.includes("Book") ? "solid" : ""} key={action} type="button">
            {action}
          </button>
        ))}
      </div>
    </article>
  );
}

function applyEnvelope(current: TripState | null, envelope: CopilotEnvelope): TripState | null {
  return envelope.tripActions.reduce((next, patch) => applyPatch(next, patch), current);
}

function defaultActions(block: TripBlock): string[] {
  if (block.address) return ["Show to Local"];
  if (block.type === "transport") return ["Route"];
  return ["Ask Copilot"];
}

function ensureAnonId(): string {
  const existing = window.localStorage.getItem(ANON_ID_KEY);
  if (existing) return existing;
  const anonId = `anon_${crypto.randomUUID()}`;
  window.localStorage.setItem(ANON_ID_KEY, anonId);
  return anonId;
}

function progressLabel(progress: GenerationProgress): string {
  if (progress.status === "idle") return "Ready";
  if (progress.status === "skeleton") return "Building skeleton";
  if (progress.status === "completing") {
    return `Filling details ${progress.completedDays}/${progress.totalDays}`;
  }
  if (progress.status === "completed") return "Complete";
  return progress.error ? `Failed: ${progress.error}` : "Completion failed";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function statusLabel(status: NonNullable<TripBlock["status"]>): string {
  if (status === "needs_attention") return "Needs attention";
  return status.replace("_", " ");
}

function toolCardHref(kind: CopilotEnvelope["toolCards"][number]["kind"]): string {
  const hrefs: Record<CopilotEnvelope["toolCards"][number]["kind"], string> = {
    payment: "/guides/payment",
    network: "/guides/network",
    transport: "/explore",
    emergency: "/human-help",
    show_to_local: "/human-help",
  };
  return hrefs[kind];
}

function toolCardCta(kind: CopilotEnvelope["toolCards"][number]["kind"]): string {
  const labels: Record<CopilotEnvelope["toolCards"][number]["kind"], string> = {
    payment: "Open payment guide",
    network: "Open network guide",
    transport: "Explore routes",
    emergency: "Request help",
    show_to_local: "Prepare a local card",
  };
  return labels[kind];
}

function commercialActionHref(action: CopilotEnvelope["commercialActions"][number]): string {
  const params = new URLSearchParams({
    partner: action.partner,
    url: action.url ?? "",
    source: "copilot",
    intent: "commerce_intent",
    entityId: action.id,
  });
  return `/outbound?${params.toString()}`;
}

function humanHelpHref(help: NonNullable<CopilotEnvelope["humanHelp"]>): string {
  const params = new URLSearchParams({
    kind: help.kind === "quote" ? "other" : "other",
    description: help.prefill,
  });
  if (help.city) params.set("city", help.city);
  return `/human-help?${params.toString()}`;
}

function citationHref(factId: string): string | null {
  if (factId.startsWith("guide:")) return `/guides/${encodeURIComponent(factId.slice(6))}`;
  if (factId.startsWith("poi:")) return "/explore";
  return null;
}
