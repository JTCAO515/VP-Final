import { describe, expect, it } from "vitest";

import {
  DEFAULT_RESCUE_HUMAN_HELP_AVAILABILITY,
  RESCUE_ROUTE_DEFINITIONS,
  RescueRequestSchema,
  resolveRescueRoute,
} from "./index.js";

describe("Rescue Mode routing contract", () => {
  it("has a deterministic definition for every supported incident category", () => {
    expect(Object.keys(RESCUE_ROUTE_DEFINITIONS)).toHaveLength(6);
    for (const category of Object.keys(RESCUE_ROUTE_DEFINITIONS)) {
      expect(
        RescueRequestSchema.safeParse({ version: 1, category, availableTargetIds: [] }).success,
      ).toBe(true);
    }
  });

  it("fails closed when a non-emergency reviewed target has not been made available", () => {
    const route = resolveRescueRoute({
      version: 1,
      category: "payment_problem",
      availableTargetIds: [],
    });

    expect(route.primaryAction).toMatchObject({ kind: "unavailable", targetId: null });
    expect(route.humanHelpOffer.status).toBe("unavailable");
  });

  it("routes health and safety directly to the official emergency boundary and never Human Help", () => {
    const route = resolveRescueRoute(
      { version: 1, category: "health_safety", availableTargetIds: [] },
      {
        status: "available",
        supportedCities: ["Shanghai"],
        supportedCategories: ["health_safety"],
        hoursLabel: "09:00-21:00 CST",
        responseExpectation: "best_effort_no_sla",
        operationalOwnerId: "ops-preview-shanghai",
      },
    );

    expect(route.primaryAction).toMatchObject({
      kind: "official_guidance",
      targetId: "emergency_boundary",
    });
    expect(route.humanHelpOffer.status).toBe("not_eligible");
  });

  it("only offers Human Help when a real city/category availability input matches", () => {
    const availability = {
      status: "available" as const,
      supportedCities: ["Shanghai"],
      supportedCategories: ["transport_problem" as const],
      hoursLabel: "09:00-21:00 CST",
      responseExpectation: "best_effort_no_sla" as const,
      operationalOwnerId: "ops-preview-shanghai",
    };
    const route = resolveRescueRoute(
      {
        version: 1,
        category: "transport_problem",
        city: "Shanghai",
        availableTargetIds: ["transport_preparation"],
      },
      availability,
    );

    expect(route.primaryAction.kind).toBe("reviewed_tool");
    expect(route.humanHelpOffer).toEqual({
      status: "available",
      hoursLabel: "09:00-21:00 CST",
      responseExpectation: "best_effort_no_sla",
    });
    expect(DEFAULT_RESCUE_HUMAN_HELP_AVAILABILITY.status).toBe("unavailable");
  });
});
