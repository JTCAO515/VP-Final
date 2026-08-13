import type { TelemetryEvent } from "@visepanda/domain";
import type { Db } from "./client.js";
import { telemetryEvents, users } from "./schema.js";
import {
  deliverPostHogSafely,
  prepareTelemetryEvent,
  type TelemetryService,
  type TelemetryServiceOptions,
} from "../modules/telemetry/service.js";

export function createDbTelemetryService(
  db: Db,
  options: TelemetryServiceOptions = {},
): TelemetryService {
  return {
    async track(input) {
      const event = prepareTelemetryEvent(input, options);
      let inserted = false;
      await db.transaction(async (tx) => {
        if (event.user_id) {
          await tx.insert(users).values({ id: event.user_id }).onConflictDoNothing();
        }
        const [stored] = await tx
          .insert(telemetryEvents)
          .values(toTelemetryInsert(event))
          .onConflictDoNothing({ target: telemetryEvents.id })
          .returning({ id: telemetryEvents.id });
        inserted = Boolean(stored);
      });
      if (inserted) await deliverPostHogSafely(event, options);
      return event;
    },
  };
}

function toTelemetryInsert(event: TelemetryEvent) {
  return {
    id: event.id,
    userId: event.user_id ?? null,
    anonId: event.anon_id ?? null,
    surface: event.surface,
    action: event.action,
    entityType: event.entity_type,
    entityId: event.entity_id ?? null,
    intent: event.intent ?? null,
    partner: event.partner ?? null,
    clickId: event.click_id ?? null,
    propsJsonb: event.props_jsonb,
    retentionExpiresAt: new Date(event.retention_expires_at),
    createdAt: new Date(event.created_at),
  };
}
