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
        try {
          const eventIntent = CopilotIntentSchema.safeParse(command.intent).data;
          await input.telemetryService.track({
            ...telemetryIdentity(command.identity),
            surface: "web",
            action: "outbound_clicked",
            entity_type: "outbound_click",
            entity_id: redirect.click.id,
            partner: redirect.click.partner,
            click_id: redirect.click.id,
            ...(eventIntent ? { intent: eventIntent } : {}),
            props_jsonb: {},
          });
        } catch {
          input.onTelemetryError?.();
          console.warn("outbound_telemetry_write_failed", {
            failureClass: "persistence_error",
            clickId: redirect.click.id,
          });
        }
      }
      return redirect;
    },
  };
}

function telemetryIdentity(identity: OutboundIdentity): {
  user_id?: string;
  anon_id?: string;
} {
  return identity.kind === "anonymous"
    ? { anon_id: identity.anonId }
    : { user_id: identity.userId };
}
