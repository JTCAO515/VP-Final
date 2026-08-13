import { describe, expect, it } from "vitest";
import { getRescueRuntimeConfiguration } from "./runtime";

const baseEnvironment = {
  VISEPANDA_RESCUE_AVAILABLE_TARGET_IDS: "payment_preparation,unknown_target",
  VISEPANDA_RESCUE_HUMAN_HELP_ENABLED: "true",
  VISEPANDA_RESCUE_HUMAN_HELP_CITIES: "Shanghai",
  VISEPANDA_RESCUE_HUMAN_HELP_CATEGORIES: "transport_problem,language_barrier",
  VISEPANDA_RESCUE_HUMAN_HELP_START_HOUR: "9",
  VISEPANDA_RESCUE_HUMAN_HELP_END_HOUR: "21",
  VISEPANDA_RESCUE_HUMAN_HELP_HOURS_LABEL: "09:00-21:00 China Standard Time",
  VISEPANDA_RESCUE_HUMAN_HELP_OWNER_ID: "ops-preview-shanghai",
};

describe("Rescue runtime configuration", () => {
  it("fails closed until a complete current operational scope is configured", () => {
    const configuration = getRescueRuntimeConfiguration({}, new Date("2026-08-14T04:00:00.000Z"));

    expect(configuration.availableTargetIds).toEqual([]);
    expect(configuration.actionHrefs).toEqual({});
    expect(configuration.humanHelpAvailability).toEqual({ status: "unavailable" });
  });

  it("only exposes configured reviewed action targets and an in-hours Human Help scope", () => {
    const configuration = getRescueRuntimeConfiguration(
      baseEnvironment,
      new Date("2026-08-14T04:00:00.000Z"),
    );

    expect(configuration.availableTargetIds).toEqual(["payment_preparation"]);
    expect(configuration.actionHrefs).toEqual({ payment_preparation: "/guides/payment" });
    expect(configuration.humanHelpAvailability).toMatchObject({
      status: "available",
      supportedCities: ["Shanghai"],
      supportedCategories: ["transport_problem", "language_barrier"],
      responseExpectation: "best_effort_no_sla",
    });
  });

  it("removes the Human Help offer outside the configured China-time window", () => {
    const configuration = getRescueRuntimeConfiguration(
      baseEnvironment,
      new Date("2026-08-14T14:00:00.000Z"),
    );

    expect(configuration.humanHelpAvailability).toEqual({ status: "unavailable" });
  });
});
