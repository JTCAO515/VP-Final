"use client";

import { useEffect, useState } from "react";
import {
  CopilotEnvelopeSchema,
  GenerationProgressSchema,
  TripStateSchema,
  type CopilotEnvelope,
  type GenerationProgress,
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

  async function submitPrompt() {
    const prompt = input.trim();
    if (!prompt || isWorking) return;

    setMessages((current) => [...current, { role: "user", body: prompt }]);
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
        { role: "assistant", body: envelope.message.body, envelope },
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
          <a href="/explore">Explore</a>
          <a href="/guides/payment">Tools</a>
          <a href="/account">Account</a>
        </nav>
        <div className="tripMeta">
          <span>China Travel AI Copilot</span>
          <i aria-hidden="true" />
        </div>
      </header>

      <section className="copilotLayout">
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
            This financing demo answers travel questions. It does not save or edit itineraries, book
            services, or connect you to a human agent.
          </p>
          <div className="railMessages">
            {messages.map((message, index) => (
              <article className={`railMessage ${message.role}`} key={`${message.role}-${index}`}>
                <b>{message.role === "user" ? "You" : "VisePanda Copilot"}</b>
                {message.envelope ? (
                  <EnvelopeMessage envelope={message.envelope} />
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
              <button onClick={() => void submitPrompt()} type="button">
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
      </section>
    </main>
  );
}

function EnvelopeMessage({ envelope }: { envelope: CopilotEnvelope }) {
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
    </div>
  );
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
