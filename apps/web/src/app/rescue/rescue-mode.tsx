"use client";

import { useState } from "react";
import {
  DEFAULT_RESCUE_HUMAN_HELP_AVAILABILITY,
  RESCUE_ROUTING_VERSION,
  resolveRescueRoute,
  type RescueCategory,
} from "@visepanda/domain";
import { captureClientTelemetry } from "../../lib/clientTelemetry";
import type { RescueRuntimeConfiguration } from "./runtime";

const RESCUE_CATEGORIES: ReadonlyArray<{
  id: RescueCategory;
  label: string;
  description: string;
  marker: string;
}> = [
  {
    id: "payment_problem",
    label: "Payment problem",
    description: "A card, cash, or payment setup has stopped your next step.",
    marker: "01",
  },
  {
    id: "transport_problem",
    label: "Transport problem",
    description: "You are unsure how to continue by metro, taxi, or other local transport.",
    marker: "02",
  },
  {
    id: "language_barrier",
    label: "Language barrier",
    description: "You need a clear way to communicate a practical need.",
    marker: "03",
  },
  {
    id: "ticket_booking_problem",
    label: "Ticket or booking problem",
    description: "A ticket, reservation, or identity detail needs attention.",
    marker: "04",
  },
  {
    id: "lost_item",
    label: "Lost item",
    description: "A personal item is missing and you need the safest official next step.",
    marker: "05",
  },
  {
    id: "health_safety",
    label: "Health or immediate safety",
    description: "There is serious illness, immediate danger, or an urgent safety concern.",
    marker: "06",
  },
];

type RescueModeProps = Readonly<{
  configuration?: RescueRuntimeConfiguration;
}>;

const UNAVAILABLE_CONFIGURATION: RescueRuntimeConfiguration = {
  availableTargetIds: [],
  actionHrefs: {},
  humanHelpAvailability: DEFAULT_RESCUE_HUMAN_HELP_AVAILABILITY,
};

const HUMAN_HELP_KIND_BY_CATEGORY: Readonly<Partial<Record<RescueCategory, string>>> = {
  transport_problem: "transport_help",
  language_barrier: "translation_help",
  ticket_booking_problem: "ticket_help",
  lost_item: "other",
  payment_problem: "other",
};

export function RescueMode({ configuration = UNAVAILABLE_CONFIGURATION }: RescueModeProps) {
  const [selectedCategory, setSelectedCategory] = useState<RescueCategory | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>("");
  const route = selectedCategory
    ? resolveRescueRoute(
        {
          version: RESCUE_ROUTING_VERSION,
          category: selectedCategory,
          ...(selectedCity ? { city: selectedCity } : {}),
          availableTargetIds: configuration.availableTargetIds,
        },
        configuration.humanHelpAvailability,
      )
    : null;

  function chooseCategory(category: RescueCategory): void {
    setSelectedCategory(category);
    captureClientTelemetry({
      action: "rescue_started",
      entity_type: "rescue_route",
      entity_id: category,
      props_jsonb: { category },
    });
    const nextRoute = resolveRescueRoute(
      {
        version: RESCUE_ROUTING_VERSION,
        category,
        ...(selectedCity ? { city: selectedCity } : {}),
        availableTargetIds: configuration.availableTargetIds,
      },
      configuration.humanHelpAvailability,
    );
    captureClientTelemetry({
      action: "rescue_route_selected",
      entity_type: "rescue_route",
      entity_id: category,
      props_jsonb: { category, primaryActionKind: nextRoute.primaryAction.kind },
    });
  }

  return (
    <>
      <section className="rescueHero" aria-labelledby="rescue-title">
        <div>
          <p className="pageEyebrow">When plans change</p>
          <h1 id="rescue-title">Rescue Mode</h1>
          <p>
            Choose the practical problem in front of you. VisePanda will show only a deterministic
            next step it can support today.
          </p>
        </div>
        <aside className="rescueBoundary" aria-label="Rescue Mode limits">
          <b>Important boundary</b>
          <p>
            This is not emergency, medical, legal, police, embassy, or 24/7 support. For immediate
            danger or serious illness, contact official emergency services now.
          </p>
          <a href="/emergency-disclaimer">Official emergency guidance</a>
        </aside>
      </section>

      <section className="rescueContent" aria-label="Choose a practical travel problem">
        <div className="rescueCategoryColumn">
          <div className="rescueSectionHeading">
            <div>
              <p className="pageEyebrow">Choose one situation</p>
              <h2>What needs attention?</h2>
            </div>
            <span>Fixed categories only</span>
          </div>
          <div className="rescueCategories" role="list">
            {RESCUE_CATEGORIES.map((category) => (
              <button
                aria-pressed={selectedCategory === category.id}
                className={selectedCategory === category.id ? "selected" : ""}
                key={category.id}
                onClick={() => chooseCategory(category.id)}
                type="button"
              >
                <span aria-hidden="true">{category.marker}</span>
                <b>{category.label}</b>
                <small>{category.description}</small>
              </button>
            ))}
          </div>
          {configuration.humanHelpAvailability.status === "available" ? (
            <label className="rescueCitySelect">
              <span>Current city for the limited Human Help preview</span>
              <select
                onChange={(event) => setSelectedCity(event.target.value)}
                value={selectedCity}
              >
                <option value="">Select a configured city</option>
                {configuration.humanHelpAvailability.supportedCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              <small>
                Currently configured: {configuration.humanHelpAvailability.hoursLabel}. Requests are
                best-effort, with no response-time guarantee.
              </small>
            </label>
          ) : null}
        </div>

        <aside className="rescueResult" aria-live="polite">
          {route === null ? (
            <div className="rescueEmptyState">
              <p className="pageEyebrow">Your next step</p>
              <h2>Select a situation first.</h2>
              <p>
                We do not collect an incident description here. Choose the closest fixed category to
                see the currently supportable route.
              </p>
            </div>
          ) : route.primaryAction.kind === "official_guidance" ? (
            <div className="rescueOfficialResult">
              <p className="pageEyebrow">Official guidance first</p>
              <h2>Do not wait for VisePanda.</h2>
              <p>{route.primaryAction.message}</p>
              <a className="pageAction" href="/emergency-disclaimer">
                Open official emergency guidance
              </a>
            </div>
          ) : route.primaryAction.kind !== "unavailable" &&
            route.primaryAction.targetId !== null &&
            configuration.actionHrefs[route.primaryAction.targetId] ? (
            <div className="rescueReviewedResult">
              <p className="pageEyebrow">Reviewed self-service step</p>
              <h2>Start with the current guide.</h2>
              <p>{route.primaryAction.message}</p>
              <a
                className="pageAction"
                href={configuration.actionHrefs[route.primaryAction.targetId]}
              >
                Open reviewed guidance
              </a>
            </div>
          ) : (
            <div className="rescueUnavailableResult">
              <p className="pageEyebrow">Current availability</p>
              <h2>This route is not available yet.</h2>
              <p>{route.primaryAction.message}</p>
              <p>
                We will not pretend that a reviewed tool or Human Help handoff is active when it is
                not configured for this situation.
              </p>
              <a className="textAction" href="/visepanda?context=trip">
                Ask VisePanda a general travel question
              </a>
            </div>
          )}

          {route?.humanHelpOffer.status === "available" && selectedCategory ? (
            <div className="rescueHumanHelpOffer">
              <p className="pageEyebrow">Optional manual review</p>
              <h2>Human Help may review this request.</h2>
              <p>
                Current preview hours: {route.humanHelpOffer.hoursLabel}. A request is free to
                submit for triage; no price, payment, booking, or outcome is promised.
              </p>
              <p>
                No Trip, block, location, or incident narrative is being carried from Rescue. You
                can change the task type and enter only the details you choose before submitting.
              </p>
              <a
                className="pageAction"
                href={`/human-help?kind=${encodeURIComponent(
                  HUMAN_HELP_KIND_BY_CATEGORY[selectedCategory] ?? "other",
                )}`}
              >
                Continue to Human Help
              </a>
            </div>
          ) : null}

          <div className="rescuePrivacyNote">
            <b>Privacy by default</b>
            <p>
              This screen records only the selected category and fixed route result. It does not
              send your incident narrative, contact details, exact location, or health information.
            </p>
          </div>
        </aside>
      </section>
    </>
  );
}
