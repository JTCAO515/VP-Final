import { CopilotIntentSchema, type OutboundClickRecord } from "@visepanda/domain";
import type { RequestIdentity } from "../../context.js";
import type { TelemetryService } from "../telemetry/service.js";

export type OutboundIdentity = Exclude<RequestIdentity, { kind: "none" }>;

export type CreateOutboundRedirectCommand = {
  identity: OutboundIdentity;
  partnerKey: string;
  targetUrl: string;
  source?: string;
  intent?: string;
  entityId?: string;
};

export type OutboundRedirect = {
  click: OutboundClickRecord;
  redirectUrl: string;
};

export type OutboundClickWriter = {
  createRedirect(input: CreateOutboundRedirectCommand): Promise<OutboundRedirect>;
};

export type CommerceService = {
  createOutboundRedirect(input: CreateOutboundRedirectCommand): Promise<OutboundRedirect>;
};

export class PartnerUnavailableError extends Error {
  readonly code = "PARTNER_UNAVAILABLE";

  constructor() {
    super("This partner link is unavailable.");
    this.name = "PartnerUnavailableError";
  }
}

export class InvalidOutboundTargetError extends Error {
  readonly code = "INVALID_OUTBOUND_TARGET";

  constructor() {
    super("This partner destination is invalid.");
    this.name = "InvalidOutboundTargetError";
  }
}

export function createCommerceService(input: {
  writer: OutboundClickWriter;
  telemetryService?: TelemetryService;
  onTelemetryError?: () => void;
}): CommerceService {
  return {
    async createOutboundRedirect(command) {
      const redirect = await input.writer.createRedirect(command);
      if (input.telemetryService) {
        recordOutboundTelemetrySafely(input, command, redirect);
      }
      return redirect;
    },
  };
}

function recordOutboundTelemetrySafely(
  input: Parameters<typeof createCommerceService>[0],
  command: CreateOutboundRedirectCommand,
  redirect: OutboundRedirect,
): void {
  const eventIntent = CopilotIntentSchema.safeParse(command.intent).data;
  const base = {
    ...telemetryIdentity(command.identity),
    surface: "web" as const,
    entity_type: "outbound_click",
    entity_id: redirect.click.id,
    partner: redirect.click.partner,
    click_id: redirect.click.id,
    ...(eventIntent ? { intent: eventIntent } : {}),
    props_jsonb: {},
  };
  try {
    void Promise.all([
      input.telemetryService!.track({ ...base, action: "outbound_clicked" }),
      input.telemetryService!.track({ ...base, action: "partner_redirected" }),
    ]).catch(() => {
      input.onTelemetryError?.();
      console.warn("outbound_telemetry_write_failed", {
        failureClass: "persistence_error",
        clickId: redirect.click.id,
      });
    });
  } catch {
    input.onTelemetryError?.();
    console.warn("outbound_telemetry_write_failed", {
      failureClass: "persistence_error",
      clickId: redirect.click.id,
    });
  }
}

function telemetryIdentity(identity: OutboundIdentity): {
  user_id?: string;
  anon_id?: string;
} {
  return identity.kind === "anonymous"
    ? { anon_id: identity.anonId }
    : { user_id: identity.userId };
}
