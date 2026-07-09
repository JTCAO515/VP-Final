import { randomUUID } from "node:crypto";
import { TelemetryEventSchema, type TelemetryEvent } from "@visepanda/domain";

export type TelemetryInput = Omit<TelemetryEvent, "id" | "created_at" | "props_jsonb"> & {
  id?: string | undefined;
  created_at?: string | undefined;
  props_jsonb?: Record<string, unknown> | undefined;
};

export type TelemetryService = {
  track(input: TelemetryInput): Promise<TelemetryEvent>;
  list(): Promise<TelemetryEvent[]>;
};

export type PostHogConfig = {
  apiKey?: string;
  host?: string;
};

export function createInMemoryTelemetryService(
  config: {
    posthog?: PostHogConfig;
    fetchFn?: typeof fetch;
  } = {},
): TelemetryService {
  const events: TelemetryEvent[] = [];

  return {
    async track(input) {
      const event = TelemetryEventSchema.parse({
        ...input,
        id: input.id ?? randomUUID(),
        created_at: input.created_at ?? new Date().toISOString(),
      });
      events.push(event);
      await sendPostHog(event, config.posthog, config.fetchFn);
      return event;
    },
    async list() {
      return events;
    },
  };
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
