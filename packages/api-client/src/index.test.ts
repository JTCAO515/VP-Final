import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { CopilotEnvelope, TripState } from "@visepanda/domain";
import { expect, expectTypeOf, it } from "vitest";
import { createApiClient } from "./index.js";
import type { AppRouter } from "./index.js";

it("creates a typed tRPC client", () => {
  expect(createApiClient("https://example.com")).toBeTruthy();
});

it("keeps client inputs and outputs tied to the app router", () => {
  type Inputs = inferRouterInputs<AppRouter>;
  type Outputs = inferRouterOutputs<AppRouter>;

  expectTypeOf<Inputs["trip"]["get"]>().toEqualTypeOf<{ id: string }>();
  expectTypeOf<Outputs["trip"]["create"]>().toEqualTypeOf<TripState>();
  expectTypeOf<Outputs["trip"]["get"]>().toEqualTypeOf<TripState | null>();
  const copilotInput: Inputs["copilot"]["run"] = {
    message: "Plan a trip",
    currentTrip: null,
  };

  expect(copilotInput.message).toBe("Plan a trip");
  expectTypeOf<Outputs["copilot"]["run"]["envelope"]>().toEqualTypeOf<CopilotEnvelope>();
  expectTypeOf<Outputs["copilot"]["run"]["trip"]>().toEqualTypeOf<TripState | null>();
});
