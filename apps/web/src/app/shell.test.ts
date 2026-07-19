import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  anonymousTurnNotice,
  attachTripToLatestAssistant,
  CopilotShell,
  previewTripDays,
  progressLabel,
} from "./shell";

const completedTrip = {
  id: "a0a00000-0000-4000-8000-000000000001",
  title: "Completed Shanghai trip",
  destinationCountry: "CN" as const,
  days: [{ id: "day-1", dayNumber: 1, blocks: [] }],
};

describe("previewTripDays", () => {
  it("preserves only the first three server-returned days for the read-only demo preview", () => {
    const days = previewTripDays({
      id: "a0a00000-0000-4000-8000-000000000001",
      title: "Shanghai practical trip",
      destinationCountry: "CN",
      days: [
        { id: "day-1", dayNumber: 1, blocks: [] },
        { id: "day-2", dayNumber: 2, blocks: [] },
        { id: "day-3", dayNumber: 3, blocks: [] },
        { id: "day-4", dayNumber: 4, blocks: [] },
      ],
    });

    expect(days.map((day) => day.id)).toEqual(["day-1", "day-2", "day-3"]);
  });

  it("updates the latest assistant Trip in place without creating a second chat bubble", () => {
    const envelope = {
      intent: "trip_create" as const,
      message: {
        headline: "Shanghai skeleton",
        body: "The details will arrive silently.",
        highlights: [],
      },
      tripActions: [],
      citations: [],
      toolCards: [],
      commercialActions: [],
      humanHelp: null,
      risk: { level: "low" as const, reason: null },
    };
    const messages = [
      { role: "user" as const, body: "Plan Shanghai" },
      {
        role: "assistant" as const,
        body: envelope.message.body,
        envelope,
        trip: null,
      },
    ];

    const updated = attachTripToLatestAssistant(messages, completedTrip);

    expect(updated).toHaveLength(messages.length);
    expect(updated[0]).toBe(messages[0]);
    expect(updated[1]).toMatchObject({ body: envelope.message.body, trip: completedTrip });
  });

  it("renders an honest new-visitor state without live-preview claims or an actionable blank submit", () => {
    const runtimeGlobal = globalThis as typeof globalThis & { React?: typeof React };
    runtimeGlobal.React = React;
    const html = renderToStaticMarkup(React.createElement(CopilotShell));
    delete runtimeGlobal.React;

    expect(html).toContain("Illustrative arrival example");
    expect(html).toContain("Not live trip data");
    expect(html).toContain("No request yet");
    expect(html).toContain('aria-label="Trip prompt"');
    expect(html).toContain('<button disabled="" type="submit">Ask Copilot</button>');
    expect(html).not.toContain("productLiveDot");
    expect(html).not.toContain(">Ready<");
  });

  it("describes request evidence rather than provider health", () => {
    expect(progressLabel(progress("idle"), false)).toBe("No request yet");
    expect(progressLabel(progress("skeleton"), false)).toBe("Request in progress");
    expect(progressLabel(progress("completing"), false)).toBe("Trip details in progress");
    expect(progressLabel(progress("completed"), false)).toBe("Answer received");
    expect(progressLabel(progress("failed"), false)).toBe("Request failed");
    expect(progressLabel(progress("failed"), true)).toBe("Details need attention");
  });

  it("shows the account warning only after all anonymous turns are complete", () => {
    expect(anonymousTurnNotice({ completedTurns: 2, limit: 3, remaining: 1 }, false)).toBeNull();
    expect(anonymousTurnNotice({ completedTurns: 3, limit: 3, remaining: 0 }, false)).toEqual({
      title: "Your next question needs an account.",
      detail:
        "You have used all 3 anonymous Copilot turns. Create an account or sign in before you continue.",
    });
  });

  it("states that a blocked fourth question never reached a model", () => {
    expect(anonymousTurnNotice({ completedTurns: 3, limit: 3, remaining: 0 }, true)).toEqual({
      title: "Your anonymous preview is complete.",
      detail:
        "Create an account or sign in before asking another question. Your blocked question was not sent to a model.",
    });
    expect(anonymousTurnNotice(null, true)).toEqual({
      title: "Sign in to continue.",
      detail: "This anonymous question was blocked before it reached a model.",
    });
  });
});

function progress(status: "idle" | "skeleton" | "completing" | "completed" | "failed") {
  return {
    status,
    completedDays: 0,
    totalDays: 0,
    attempts: 0,
    error: status === "failed" ? "Unavailable" : null,
  };
}
