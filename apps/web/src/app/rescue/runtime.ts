import {
  DEFAULT_RESCUE_HUMAN_HELP_AVAILABILITY,
  RESCUE_ROUTE_DEFINITIONS,
  RescueCategorySchema,
  RescueHumanHelpAvailabilitySchema,
  type RescueHumanHelpAvailability,
} from "@visepanda/domain";

type Environment = Readonly<Record<string, string | undefined>>;

export type RescueRuntimeConfiguration = Readonly<{
  availableTargetIds: string[];
  actionHrefs: Readonly<Record<string, string>>;
  humanHelpAvailability: RescueHumanHelpAvailability;
}>;

const CONFIGURED_ACTION_HREFS: Readonly<Record<string, string>> = {
  payment_preparation: "/guides/payment",
};

/**
 * A Rescue action is public only when its route id is explicitly enabled and
 * has a reviewed first-party destination. Unknown ids never become links.
 */
export function getRescueRuntimeConfiguration(
  env: Environment = process.env,
  now = new Date(),
): RescueRuntimeConfiguration {
  const enabledTargets = parseEnabledTargets(env.VISEPANDA_RESCUE_AVAILABLE_TARGET_IDS);
  const actionHrefs = Object.fromEntries(
    enabledTargets.flatMap((targetId) => {
      const href = CONFIGURED_ACTION_HREFS[targetId];
      return href ? [[targetId, href]] : [];
    }),
  );

  return {
    availableTargetIds: Object.keys(actionHrefs),
    actionHrefs,
    humanHelpAvailability: getCurrentHumanHelpAvailability(env, now),
  };
}

function parseEnabledTargets(value: string | undefined): string[] {
  const definedTargets = new Set(
    Object.values(RESCUE_ROUTE_DEFINITIONS).map((definition) => definition.targetId),
  );
  return [...new Set(splitCsv(value))].filter((targetId) => definedTargets.has(targetId));
}

function getCurrentHumanHelpAvailability(env: Environment, now: Date): RescueHumanHelpAvailability {
  if (env.VISEPANDA_RESCUE_HUMAN_HELP_ENABLED !== "true") {
    return DEFAULT_RESCUE_HUMAN_HELP_AVAILABILITY;
  }

  const cities = splitCsv(env.VISEPANDA_RESCUE_HUMAN_HELP_CITIES);
  const categories = splitCsv(env.VISEPANDA_RESCUE_HUMAN_HELP_CATEGORIES).flatMap((category) => {
    const parsed = RescueCategorySchema.safeParse(category);
    return parsed.success ? [parsed.data] : [];
  });
  const startHour = parseChinaHour(env.VISEPANDA_RESCUE_HUMAN_HELP_START_HOUR);
  const endHour = parseChinaHour(env.VISEPANDA_RESCUE_HUMAN_HELP_END_HOUR);
  const ownerId = env.VISEPANDA_RESCUE_HUMAN_HELP_OWNER_ID?.trim();
  const hoursLabel = env.VISEPANDA_RESCUE_HUMAN_HELP_HOURS_LABEL?.trim();

  if (
    cities.length === 0 ||
    categories.length === 0 ||
    !ownerId ||
    !hoursLabel ||
    startHour === null ||
    endHour === null ||
    startHour >= endHour ||
    !isWithinChinaHours(now, startHour, endHour)
  ) {
    return DEFAULT_RESCUE_HUMAN_HELP_AVAILABILITY;
  }

  const parsed = RescueHumanHelpAvailabilitySchema.safeParse({
    status: "available",
    supportedCities: cities,
    supportedCategories: categories,
    hoursLabel,
    responseExpectation: "best_effort_no_sla",
    operationalOwnerId: ownerId,
  });
  return parsed.success ? parsed.data : DEFAULT_RESCUE_HUMAN_HELP_AVAILABILITY;
}

function splitCsv(value: string | undefined): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function parseChinaHour(value: string | undefined): number | null {
  if (!value || !/^\d{1,2}$/.test(value)) return null;
  const hour = Number(value);
  return Number.isInteger(hour) && hour >= 0 && hour <= 24 ? hour : null;
}

function isWithinChinaHours(now: Date, startHour: number, endHour: number): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Shanghai",
    }).format(now),
  );
  return Number.isFinite(hour) && hour >= startHour && hour < endHour;
}
