import { z } from "zod";

export const RESCUE_ROUTING_VERSION = 1 as const;

export const RescueCategorySchema = z.enum([
  "payment_problem",
  "transport_problem",
  "language_barrier",
  "ticket_booking_problem",
  "lost_item",
  "health_safety",
]);
export const RescuePrimaryActionKindSchema = z.enum([
  "reviewed_tool",
  "show_to_local",
  "official_guidance",
  "unavailable",
]);
export const RescueHumanHelpOfferStatusSchema = z.enum([
  "not_eligible",
  "unavailable",
  "available",
]);

const RescueCitySchema = z.string().trim().min(1).max(100);
const RescueTargetIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

export const RescueRequestSchema = z
  .object({
    version: z.literal(RESCUE_ROUTING_VERSION),
    category: RescueCategorySchema,
    city: RescueCitySchema.optional(),
    availableTargetIds: z.array(RescueTargetIdSchema).default([]),
  })
  .strict();

export const RescueHumanHelpAvailabilitySchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("unavailable"),
    })
    .strict(),
  z
    .object({
      status: z.literal("available"),
      supportedCities: z.array(RescueCitySchema).min(1).max(20),
      supportedCategories: z.array(RescueCategorySchema).min(1).max(5),
      hoursLabel: z.string().trim().min(1).max(120),
      responseExpectation: z.literal("best_effort_no_sla"),
      operationalOwnerId: z.string().trim().min(1).max(120),
    })
    .strict(),
]);

export const RescuePrimaryActionSchema = z
  .object({
    kind: RescuePrimaryActionKindSchema,
    targetId: RescueTargetIdSchema.nullable(),
    message: z.string().trim().min(1).max(300),
  })
  .strict();

export const RescueHumanHelpOfferSchema = z
  .object({
    status: RescueHumanHelpOfferStatusSchema,
    hoursLabel: z.string().trim().min(1).max(120).nullable(),
    responseExpectation: z.literal("best_effort_no_sla").nullable(),
  })
  .strict();

export const RescueRouteSchema = z
  .object({
    version: z.literal(RESCUE_ROUTING_VERSION),
    category: RescueCategorySchema,
    primaryAction: RescuePrimaryActionSchema,
    humanHelpOffer: RescueHumanHelpOfferSchema,
  })
  .strict();

export type RescueCategory = z.infer<typeof RescueCategorySchema>;
export type RescueRequest = z.infer<typeof RescueRequestSchema>;
export type RescueHumanHelpAvailability = z.infer<typeof RescueHumanHelpAvailabilitySchema>;
export type RescueRoute = z.infer<typeof RescueRouteSchema>;

type RescueRouteDefinition = {
  primaryKind: Exclude<z.infer<typeof RescuePrimaryActionKindSchema>, "unavailable">;
  targetId: z.infer<typeof RescueTargetIdSchema>;
  unavailableMessage: string;
  humanHelpEligible: boolean;
};

/**
 * This maps an incident category to an approved target identifier, not to user-visible prose or a
 * live service. A caller must prove the target is currently reviewed and available before it can be
 * returned as a primary route.
 */
export const RESCUE_ROUTE_DEFINITIONS: Readonly<Record<RescueCategory, RescueRouteDefinition>> = {
  payment_problem: {
    primaryKind: "reviewed_tool",
    targetId: "payment_preparation",
    unavailableMessage: "A reviewed payment help step is not currently available.",
    humanHelpEligible: true,
  },
  transport_problem: {
    primaryKind: "reviewed_tool",
    targetId: "transport_preparation",
    unavailableMessage: "A reviewed transport help step is not currently available.",
    humanHelpEligible: true,
  },
  language_barrier: {
    primaryKind: "show_to_local",
    targetId: "language_support",
    unavailableMessage: "A reviewed language support step is not currently available.",
    humanHelpEligible: true,
  },
  ticket_booking_problem: {
    primaryKind: "reviewed_tool",
    targetId: "ticket_identity_requirements",
    unavailableMessage: "A reviewed ticket or booking help step is not currently available.",
    humanHelpEligible: true,
  },
  lost_item: {
    primaryKind: "official_guidance",
    targetId: "lost_item_official_guidance",
    unavailableMessage: "Reviewed official lost-item guidance is not currently available.",
    humanHelpEligible: true,
  },
  health_safety: {
    primaryKind: "official_guidance",
    targetId: "emergency_boundary",
    unavailableMessage:
      "For immediate danger or serious illness, contact the appropriate official emergency service now. Do not wait for VisePanda or Human Help.",
    humanHelpEligible: false,
  },
};

export const DEFAULT_RESCUE_HUMAN_HELP_AVAILABILITY: RescueHumanHelpAvailability = {
  status: "unavailable",
};

export function resolveRescueRoute(
  input: z.input<typeof RescueRequestSchema>,
  humanHelpAvailability: z.input<
    typeof RescueHumanHelpAvailabilitySchema
  > = DEFAULT_RESCUE_HUMAN_HELP_AVAILABILITY,
): RescueRoute {
  const request = RescueRequestSchema.parse(input);
  const availability = RescueHumanHelpAvailabilitySchema.parse(humanHelpAvailability);
  const definition = RESCUE_ROUTE_DEFINITIONS[request.category];
  const targetAvailable = request.availableTargetIds.includes(definition.targetId);

  return RescueRouteSchema.parse({
    version: RESCUE_ROUTING_VERSION,
    category: request.category,
    primaryAction:
      targetAvailable || request.category === "health_safety"
        ? {
            kind: definition.primaryKind,
            targetId: definition.targetId,
            message:
              request.category === "health_safety"
                ? definition.unavailableMessage
                : "Use the reviewed help step for this situation.",
          }
        : {
            kind: "unavailable",
            targetId: null,
            message: definition.unavailableMessage,
          },
    humanHelpOffer: resolveHumanHelpOffer(request, definition, availability),
  });
}

function resolveHumanHelpOffer(
  request: RescueRequest,
  definition: RescueRouteDefinition,
  availability: RescueHumanHelpAvailability,
): z.infer<typeof RescueHumanHelpOfferSchema> {
  if (!definition.humanHelpEligible) {
    return { status: "not_eligible", hoursLabel: null, responseExpectation: null };
  }
  if (
    availability.status !== "available" ||
    request.city === undefined ||
    !availability.supportedCities.includes(request.city) ||
    !availability.supportedCategories.includes(request.category)
  ) {
    return { status: "unavailable", hoursLabel: null, responseExpectation: null };
  }
  return {
    status: "available",
    hoursLabel: availability.hoursLabel,
    responseExpectation: availability.responseExpectation,
  };
}
