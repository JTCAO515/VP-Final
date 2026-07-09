import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { CopilotEnvelope, GenerationProgress, Poi, TripState } from "@visepanda/domain";
import { expect, expectTypeOf, it } from "vitest";
import { createApiClient } from "./index.js";
import type { AppRouter } from "./index.js";

it("creates a typed tRPC client", () => {
  expect(createApiClient("https://example.com")).toBeTruthy();
});

it("keeps client inputs and outputs tied to the app router", () => {
  type Inputs = inferRouterInputs<AppRouter>;
  type Outputs = inferRouterOutputs<AppRouter>;

  expectTypeOf<Inputs["trip"]["get"]>().toEqualTypeOf<{
    id: string;
    userId?: string | undefined;
    anonId?: string | undefined;
    email?: string | undefined;
  }>();
  expectTypeOf<Outputs["trip"]["create"]>().toEqualTypeOf<TripState>();
  expectTypeOf<Outputs["trip"]["get"]>().toEqualTypeOf<TripState | null>();
  const copilotInput: Inputs["copilot"]["run"] = {
    message: "Plan a trip",
    currentTrip: null,
  };

  expect(copilotInput.message).toBe("Plan a trip");
  expectTypeOf<Outputs["copilot"]["run"]["envelope"]>().toEqualTypeOf<CopilotEnvelope>();
  expectTypeOf<Outputs["copilot"]["run"]["trip"]>().toEqualTypeOf<TripState | null>();
  expectTypeOf<Outputs["copilot"]["completeTrip"]>().toEqualTypeOf<GenerationProgress>();
  expectTypeOf<Outputs["knowledge"]["listPois"]>().toEqualTypeOf<Poi[]>();
  expectTypeOf<Outputs["knowledge"]["updateFact"]>().toEqualTypeOf<Poi[]>();
  expectTypeOf<Inputs["telemetry"]["track"]["action"]>().toEqualTypeOf<string>();
  expectTypeOf<Inputs["task"]["create"]["kind"]>().toEqualTypeOf<
    "call_restaurant" | "ticket_help" | "translation_help" | "transport_help" | "other"
  >();
});
