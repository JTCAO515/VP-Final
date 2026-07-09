"use client";

import { useMemo, useState } from "react";
import {
  applyPatch,
  CopilotEnvelopeSchema,
  type CopilotEnvelope,
  type GenerationProgress,
  type TripState,
} from "@visepanda/domain";

type ChatMessage = {
  role: "user" | "assistant";
  body: string;
  envelope?: CopilotEnvelope;
};

const skeletonEnvelope = CopilotEnvelopeSchema.parse({
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
            id: "trip-shanghai-demo",
            title: "Shanghai first-timer",
            destinationCountry: "CN",
            startDate: "2026-03-12",
            endDate: "2026-03-14",
            days: [
              { id: "day-1", dayNumber: 1, city: "Shanghai", title: "Arrival", blocks: [] },
              { id: "day-2", dayNumber: 2, city: "Shanghai", title: "Old town", blocks: [] },
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

const detailedEnvelope = CopilotEnvelopeSchema.parse({
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
          },
        },
      ],
    },
  ],
});

export function CopilotShell() {
  const [input, setInput] = useState("Plan a 2 day Shanghai trip");
  const [progress, setProgress] = useState<GenerationProgress>({
    status: "idle",
    completedDays: 0,
    totalDays: 0,
    attempts: 0,
    error: null,
  });
  const [trip, setTrip] = useState<TripState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", body: "Ask for a China trip plan and I will render it on the canvas." },
  ]);

  const totalBlocks = useMemo(
    () => trip?.days.reduce((sum, day) => sum + day.blocks.length, 0) ?? 0,
    [trip],
  );

  function submitPrompt() {
    const prompt = input.trim();
    if (!prompt) return;

    const skeletonTrip = applyEnvelope(null, skeletonEnvelope);
    setMessages([
      { role: "user", body: prompt },
      { role: "assistant", body: skeletonEnvelope.message.body, envelope: skeletonEnvelope },
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
      setProgress((current) => ({
        ...current,
        status: "completing",
        completedDays: Math.max(1, current.completedDays),
        attempts: current.attempts + 1,
      }));
    }, 350);

    window.setTimeout(() => {
      setTrip((current) => applyEnvelope(current, detailedEnvelope));
      setMessages((current) => [
        ...current,
        { role: "assistant", body: detailedEnvelope.message.body, envelope: detailedEnvelope },
      ]);
      setProgress((current) => ({
        ...current,
        status: "completed",
        completedDays: current.totalDays,
        attempts: current.attempts + 1,
      }));
    }, 700);
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <h1>China Travel AI Copilot</h1>
          <p>Conversation on the left. Deterministic TripState canvas on the right.</p>
        </div>
        <div className="status">{progressLabel(progress)}</div>
      </section>

      <section className="workspace">
        <div className="panel chat">
          <div className="panelHeader">
            <h2>Copilot</h2>
            <span>{messages.length} messages</span>
          </div>
          <div className="messages">
            {messages.map((message, index) => (
              <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <strong>{message.role === "user" ? "You" : "Copilot"}</strong>
                <p>{message.body}</p>
                {message.envelope?.toolCards.map((card) => (
                  <div className="toolCard" key={card.id}>
                    <b>{card.title}</b>
                    <span>{card.body}</span>
                  </div>
                ))}
              </article>
            ))}
          </div>
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              submitPrompt();
            }}
          >
            <input
              aria-label="Trip prompt"
              onChange={(event) => setInput(event.target.value)}
              value={input}
            />
            <button type="submit">Generate</button>
          </form>
        </div>

        <div className="panel canvas">
          <div className="panelHeader">
            <h2>Trip canvas</h2>
            <span>{trip ? `${trip.days.length} days · ${totalBlocks} blocks` : "No trip yet"}</span>
          </div>
          {trip ? (
            <div className="trip">
              <div>
                <h3>{trip.title}</h3>
                <p>
                  {trip.startDate} → {trip.endDate}
                </p>
              </div>
              {trip.days.map((day) => (
                <article className="day" key={day.id}>
                  <div>
                    <b>Day {day.dayNumber}</b>
                    <span>{day.city}</span>
                  </div>
                  <h4>{day.title}</h4>
                  {day.blocks.length === 0 ? (
                    <p className="skeletonLine">Skeleton day. Details are being generated.</p>
                  ) : (
                    day.blocks.map((block) => (
                      <div className="block" key={block.id}>
                        <span>{block.startTime ?? "Flexible"}</span>
                        <strong>{block.title}</strong>
                        <small>{block.description}</small>
                      </div>
                    ))
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">Generate a trip to see the canvas patch apply in real time.</div>
          )}
        </div>
      </section>
    </main>
  );
}

function applyEnvelope(current: TripState | null, envelope: CopilotEnvelope): TripState | null {
  return envelope.tripActions.reduce((next, patch) => applyPatch(next, patch), current);
}

function progressLabel(progress: GenerationProgress): string {
  if (progress.status === "idle") return "Ready";
  if (progress.status === "completed") return "Details complete";
  if (progress.status === "failed") return "Completion failed";

  return `${progress.completedDays}/${progress.totalDays} days`;
}
