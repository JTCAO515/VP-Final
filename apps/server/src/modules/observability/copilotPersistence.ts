import { createHash } from "node:crypto";
import {
  CopilotConversationTurnSchema,
  CopilotEnvelopeSchema,
  PersistedCopilotEnvelopeSchema,
  type ConversationRedactionClass,
  type CopilotConversationTurn,
  type CopilotEnvelope,
} from "@visepanda/domain";
import type { TripIdentity } from "../trip/versionedService.js";

export const DEFAULT_CONVERSATION_RETENTION_DAYS = 180;
export const DEFAULT_COST_RETENTION_DAYS = 400;
export const DEFAULT_EVENT_RETENTION_DAYS = 180;

export type CopilotRetentionPolicy = {
  conversationDays: number;
  costDays: number;
  eventDays: number;
};

export type RedactedConversation = {
  userMessage: string;
  assistantEnvelope: CopilotEnvelope | null;
  redactionClasses: ConversationRedactionClass[];
};

export function resolveCopilotRetentionPolicy(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): CopilotRetentionPolicy {
  return {
    conversationDays: parseRetentionDays(
      environment.VISEPANDA_CONV_RETENTION_DAYS,
      DEFAULT_CONVERSATION_RETENTION_DAYS,
      "VISEPANDA_CONV_RETENTION_DAYS",
    ),
    costDays: parseRetentionDays(
      environment.VISEPANDA_COST_RETENTION_DAYS,
      DEFAULT_COST_RETENTION_DAYS,
      "VISEPANDA_COST_RETENTION_DAYS",
    ),
    eventDays: parseRetentionDays(
      environment.VISEPANDA_EVENT_RETENTION_DAYS,
      DEFAULT_EVENT_RETENTION_DAYS,
      "VISEPANDA_EVENT_RETENTION_DAYS",
    ),
  };
}

export function retentionDeadline(createdAt: Date, days: number): Date {
  return new Date(createdAt.getTime() + days * 24 * 60 * 60 * 1_000);
}

export function opaqueCopilotSessionId(identity: TripIdentity): string {
  const stableIdentity =
    identity.kind === "authenticated" ? `user:${identity.userId}` : `anon:${identity.anonId}`;
  const bytes = Buffer.from(
    createHash("sha256").update(`visepanda-copilot-session:v1:${stableIdentity}`).digest(),
  ).subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function redactCopilotConversation(
  userMessage: string,
  assistantEnvelope: CopilotEnvelope | null,
): RedactedConversation {
  const classes = new Set<ConversationRedactionClass>();
  const redactedMessage = redactText(userMessage, classes).trim().slice(0, 12_000) || "[redacted]";
  const redactedEnvelope = assistantEnvelope
    ? CopilotEnvelopeSchema.parse(redactValue(assistantEnvelope, classes))
    : null;
  if (redactedEnvelope) PersistedCopilotEnvelopeSchema.parse(redactedEnvelope);
  return {
    userMessage: redactedMessage,
    assistantEnvelope: redactedEnvelope,
    redactionClasses: [...classes].sort(),
  };
}

export function prepareCopilotConversationTurn(input: {
  id: string;
  agentRunId: string;
  identity: TripIdentity;
  status: "succeeded" | "failed";
  userMessage: string;
  assistantEnvelope: CopilotEnvelope | null;
  cityIntent?: string | null;
  failureClass?: string | null;
  createdAt: Date;
  retentionDays: number;
}): CopilotConversationTurn {
  const redacted = redactCopilotConversation(input.userMessage, input.assistantEnvelope);
  return CopilotConversationTurnSchema.parse({
    id: input.id,
    session_id: opaqueCopilotSessionId(input.identity),
    agent_run_id: input.agentRunId,
    identity: identityRecord(input.identity),
    status: input.status,
    user_message: redacted.userMessage,
    assistant_envelope: redacted.assistantEnvelope,
    city_intent: input.cityIntent ?? null,
    redaction_classes: redacted.redactionClasses,
    failure_class: input.failureClass ?? null,
    created_at: input.createdAt.toISOString(),
    retention_expires_at: retentionDeadline(input.createdAt, input.retentionDays).toISOString(),
  });
}

export function identityRecord(identity: TripIdentity): {
  user_id: string | null;
  anon_id: string | null;
} {
  return identity.kind === "authenticated"
    ? { user_id: identity.userId, anon_id: null }
    : { user_id: null, anon_id: identity.anonId };
}

function parseRetentionDays(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === "") return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function redactValue(value: unknown, classes: Set<ConversationRedactionClass>): unknown {
  if (typeof value === "string") return redactText(value, classes);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, classes));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, redactValue(nested, classes)]),
    );
  }
  return value;
}

function redactText(input: string, classes: Set<ConversationRedactionClass>): string {
  let output = input;
  output = replace(output, /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi, "credential", classes);
  output = replace(output, /\b(?:sk[-_]|sb_secret_)[A-Za-z0-9._-]{12,}\b/gi, "credential", classes);
  output = replace(output, /\b[a-f0-9]{32}\.[A-Za-z0-9_-]{12,}\b/gi, "credential", classes);
  output = replace(
    output,
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    "credential",
    classes,
  );
  output = replace(
    output,
    /\b(?:api[_ -]?key|authorization|secret)\b\s*[:=]\s*[^\s,;]+/gi,
    "credential",
    classes,
  );
  output = replace(
    output,
    /\b(?:set-)?cookie\b(?:\s+(?:value\s+)?is|\s*[:=])\s*[^\s,;]+/gi,
    "cookie",
    classes,
  );
  output = replace(
    output,
    /\bsignature\b(?:\s+(?:value\s+)?is|\s*[:=])\s*[^\s,;]+/gi,
    "signature",
    classes,
  );
  output = replace(
    output,
    /\b(?:passport|visa|travel document)(?:\s+(?:number|no\.?))?(?:\s+is\s+|\s*[:#-]\s*|\s+)(?=[A-Z0-9]{6,12}\b)(?=[A-Z0-9]*\d)[A-Z0-9]+\b/gi,
    "travel_document",
    classes,
  );
  output = replace(output, /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "email", classes);
  output = replace(output, /\b(?:\+?\d[\d\s().-]{6,}\d)\b/g, "phone", classes);
  return output;
}

function replace(
  input: string,
  pattern: RegExp,
  redactionClass: ConversationRedactionClass,
  classes: Set<ConversationRedactionClass>,
): string {
  return input.replace(pattern, () => {
    classes.add(redactionClass);
    return `[redacted ${redactionClass.replace("_", " ")}]`;
  });
}
