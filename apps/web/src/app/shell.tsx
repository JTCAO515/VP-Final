"use client";

import { useState } from "react";
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

const activities = [
  {
    title: "Yu Garden (豫园)",
    detail: "Classical Ming Dynasty garden · Passport at entry",
    time: "09:00",
    alert: "Tickets selling fast today — only 12 left online. Book now.",
    tags: ["Booking Required", "Near Metro L10"],
    actions: ["Book Ticket", "Show to Local"],
    active: true,
  },
  {
    title: "Lunch · Nanxiang Steamed Bun",
    detail: "Famous xiaolongbao near Yu Garden",
    time: "12:00",
    tags: ["Cash preferred", "Queue expected"],
    actions: ["Baidu Maps"],
  },
  {
    title: "Shanghai Tower Observatory",
    detail: "World's 2nd tallest building · 632m",
    time: "14:30",
    tags: ["Near Metro L2/L14", "Foreign card OK"],
    actions: ["Book Ticket", "Baidu Maps"],
  },
  {
    title: "Dinner · Jian Guo 328",
    detail: "Classic Shanghai home cooking",
    time: "19:00",
    tags: ["Reservation useful", "Show address"],
    actions: ["Show to Local"],
  },
];

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

const initialTrip = applyEnvelope(applyEnvelope(null, skeletonEnvelope), detailedEnvelope);

export function CopilotShell() {
  const [input, setInput] = useState(
    "Plan my first 2 days in Shanghai with payment and metro tips",
  );
  const [progress, setProgress] = useState<GenerationProgress>({
    status: "completed",
    completedDays: 3,
    totalDays: 3,
    attempts: 0,
    error: null,
  });
  const [trip, setTrip] = useState<TripState | null>(initialTrip);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      body: "Good morning! It is Day 2 in Shanghai. Yu Garden tickets are going fast — only 12 left for today. Want me to book them now?",
    },
    { role: "user", body: "Yes, book now please." },
    {
      role: "assistant",
      body: "Done! 2 tickets booked for Yu Garden at 09:00. Confirmation sent to your email. I've updated your Trip Canvas.",
    },
  ]);

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

  const isWorking = progress.status === "skeleton" || progress.status === "completing";

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
        </nav>
        <div className="tripMeta">
          <span>Shanghai & Beijing · 8 Days</span>
          <i aria-hidden="true" />
        </div>
      </header>

      <section className="copilotLayout">
        <div className="tripCanvas">
          <div className="canvasToolbar">
            <div>
              <h1>Trip Canvas</h1>
              <span>{trip ? `${trip.days.length} days planned` : "No trip yet"}</span>
            </div>
            <div className="toolbarActions">
              <span className="readiness">Readiness 85%</span>
              <button type="button">Add Block</button>
            </div>
          </div>

          <div className="dayTabs" aria-label="Trip days">
            {["Day 1 · Jul 14", "Day 2 · Jul 15", "Day 3 · Jul 16"].map((day, index) => (
              <button className={index === 1 ? "selected" : ""} key={day} type="button">
                {day}
                <span>Shanghai</span>
              </button>
            ))}
            <button type="button">+ Day</button>
          </div>

          <section className="dayStage">
            <div className="dayHeading">
              <div>
                <h2>Day 2 · Jul 15</h2>
                <p>Shanghai · {activities.length} activities</p>
              </div>
              <div className="dayStepper" aria-hidden="true">
                <span>‹</span>
                <span>›</span>
              </div>
            </div>

            <div className="timeline">
              {activities.map((activity) => (
                <article
                  className={`activityCard ${activity.active ? "urgent" : ""}`}
                  key={activity.title}
                >
                  <div className="timelineDot" aria-hidden="true" />
                  <div className="activityHeader">
                    <div>
                      <h3>{activity.title}</h3>
                      <p>{activity.detail}</p>
                    </div>
                    <time>{activity.time}</time>
                  </div>
                  {activity.alert ? <div className="activityAlert">{activity.alert}</div> : null}
                  <div className="activityTags">
                    {activity.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <div className="activityActions">
                    {activity.actions.map((action) => (
                      <button
                        className={action.includes("Book") ? "solid" : ""}
                        key={action}
                        type="button"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
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
                {message.envelope?.toolCards.map((card) => (
                  <div className="toolCard railToolCard" key={card.id}>
                    <b>{card.title}</b>
                    <span>{card.body}</span>
                  </div>
                ))}
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
              submitPrompt();
            }}
          >
            <input
              aria-label="Trip prompt"
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask anything about your trip..."
              value={input}
            />
            <button disabled={isWorking} type="submit">
              Send
            </button>
          </form>
        </aside>
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
