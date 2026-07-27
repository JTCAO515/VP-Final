import { randomUUID } from "node:crypto";
import { TelemetryEventSchema, type TelemetryEvent } from "@visepanda/domain";
import {
  resolveCopilotRetentionPolicy,
  retentionDeadline,
} from "../observability/copilotPersistence.js";

export type TelemetryInput = Omit<
  TelemetryEvent,
  "id" | "created_at" | "retention_expires_at" | "props_jsonb"
> & {
  id?: string | undefined;
  created_at?: string | undefined;
  props_jsonb?: Record<string, unknown> | undefined;
};

export type TelemetryService = {
  track(input: TelemetryInput): Promise<TelemetryEvent>;
};

export type PostHogConfig = {
  apiKey?: string;
  host?: string;
};

export type TelemetryServiceOptions = {
  environment?: Readonly<Record<string, string | undefined>>;
  fetchFn?: typeof fetch;
  now?: () => Date;
  posthog?: PostHogConfig;
  randomId?: () => string;
  onDeliveryError?: () => void;
};

export function prepareTelemetryEvent(
  input: TelemetryInput,
  options: Pick<TelemetryServiceOptions, "environment" | "now" | "randomId"> = {},
): TelemetryEvent {
  const createdAt = input.created_at ? new Date(input.created_at) : (options.now?.() ?? new Date());
  const retention = resolveCopilotRetentionPolicy(options.environment).eventDays;
  return TelemetryEventSchema.parse({
    ...input,
    id: input.id ?? options.randomId?.() ?? randomUUID(),
    props_jsonb: input.props_jsonb ?? {},
    created_at: createdAt.toISOString(),
    retention_expires_at: retentionDeadline(createdAt, retention).toISOString(),
  });
}

export function createInMemoryTelemetryService(options: TelemetryServiceOptions = {}) {
  const events: TelemetryEvent[] = [];

  return {
    async track(input: TelemetryInput) {
      const event = prepareTelemetryEvent(input, options);
      events.push(event);
      await deliverPostHogSafely(event, options);
      return event;
    },
    async list() {
      return structuredClone(events);
    },
  } satisfies TelemetryService & { list(): Promise<TelemetryEvent[]> };
}

export async function sendPostHog(
  event: TelemetryEvent,
  config: PostHogConfig = {},
  fetchFn: typeof fetch = fetch,
) {
  if (!config.apiKey) return;

  await fetchFn(`${config.host ?? "https://app.posthog.com"}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: config.apiKey,
      event: event.action,
      distinct_id: event.user_id ?? event.anon_id,
      properties: {
        ...event.props_jsonb,
        surface: event.surface,
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        intent: event.intent,
        partner: event.partner,
        click_id: event.click_id,
      },
      timestamp: event.created_at,
    }),
  });
}

export async function deliverPostHogSafely(
  event: TelemetryEvent,
  options: Pick<TelemetryServiceOptions, "fetchFn" | "onDeliveryError" | "posthog">,
): Promise<void> {
  try {
    await sendPostHog(event, options.posthog, options.fetchFn);
  } catch {
    options.onDeliveryError?.();
    console.warn("telemetry_delivery_failed", { failureClass: "delivery_error" });
  }
}
