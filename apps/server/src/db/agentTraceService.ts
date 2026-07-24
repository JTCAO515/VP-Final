import { and, eq, sql } from "drizzle-orm";
import {
  CopilotIntentSchema,
  CopilotProductEventSchema,
  CopilotConversationTurnSchema,
  LlmCallCostRecordSchema,
  containsForbiddenConversationMaterial,
} from "@visepanda/domain";
import type { Db } from "./client.js";
import {
  agentRuns,
  copilotConversationTurns,
  llmCallCosts,
  telemetryEvents,
  toolCalls,
} from "./schema.js";
import {
  identityRecord,
  resolveCopilotRetentionPolicy,
  retentionDeadline,
} from "../modules/observability/copilotPersistence.js";
import type {
  AgentTraceService,
  CopilotProductEventService,
  RecordCopilotProductEventInput,
} from "../modules/trace/service.js";

export type DbAgentTraceService = AgentTraceService & CopilotProductEventService;

export function createDbAgentTraceService(db: Db): DbAgentTraceService {
  return {
    async recordRun(input) {
      const attempts = input.attempts.map((attempt) => ({
        ...(attempt.route ? { route: assertSafeModelIdentifier(attempt.route, "route", 80) } : {}),
        provider: assertSafeModelIdentifier(attempt.provider, "provider", 80),
        model: assertSafeModelIdentifier(attempt.model, "model", 160),
        status: attempt.status,
        inputTokens: attempt.inputTokens,
        outputTokens: attempt.outputTokens,
        costUsd: attempt.costUsd,
        ...(attempt.costSnapshot
          ? {
              costSnapshot: {
                provider: assertSafeModelIdentifier(attempt.costSnapshot.provider, "provider", 80),
                model: assertSafeModelIdentifier(attempt.costSnapshot.model, "model", 160),
                effort: attempt.costSnapshot.effort,
                inputTokens: attempt.costSnapshot.inputTokens,
                cachedInputTokens: attempt.costSnapshot.cachedInputTokens,
                outputTokens: attempt.costSnapshot.outputTokens,
                inputPricePerMillionUsd: attempt.costSnapshot.inputPricePerMillionUsd,
                cachedInputPricePerMillionUsd: attempt.costSnapshot.cachedInputPricePerMillionUsd,
                outputPricePerMillionUsd: attempt.costSnapshot.outputPricePerMillionUsd,
                costUsd: attempt.costSnapshot.costUsd,
                pricingMissing: attempt.costSnapshot.pricingMissing,
                fallbackTriggered: attempt.costSnapshot.fallbackTriggered,
              },
            }
          : {}),
        latencyMs: attempt.latencyMs,
        ...(attempt.failureClass ? { failureClass: attempt.failureClass } : {}),
      }));
      const inputTokens = attempts.reduce(
        (sum, attempt) => sum + (attempt.costSnapshot?.inputTokens ?? attempt.inputTokens),
        0,
      );
      const outputTokens = attempts.reduce(
        (sum, attempt) => sum + (attempt.costSnapshot?.outputTokens ?? attempt.outputTokens),
        0,
      );
      const costUsd = sumCostUsd(
        attempts.map((attempt) => attempt.costSnapshot?.costUsd ?? "0"),
        6,
      );
      const primaryAttempt = attempts.at(-1);
      const createdAt = new Date();
      const retention = resolveCopilotRetentionPolicy();
      const identity = input.identity ? identityRecord(input.identity) : null;

      if (input.conversation && !identity) {
        throw new Error("Copilot conversation persistence requires a trusted identity");
      }
      if (input.conversation && input.conversation.sessionId.length === 0) {
        throw new Error("Copilot conversation persistence requires an opaque session id");
      }

      const conversation = input.conversation
        ? CopilotConversationTurnSchema.parse({
            id: crypto.randomUUID(),
            session_id: input.conversation.sessionId,
            agent_run_id: input.id,
            identity,
            status: input.status,
            user_message: input.conversation.userMessage,
            assistant_envelope: input.conversation.assistantEnvelope,
            city_intent: input.conversation.cityIntent,
            redaction_classes: input.conversation.redactionClasses,
            failure_class: input.failureClass ?? null,
            created_at: createdAt.toISOString(),
            retention_expires_at: retentionDeadline(
              createdAt,
              retention.conversationDays,
            ).toISOString(),
          })
        : null;

      const costRecords = input.conversation
        ? attempts.map((attempt, index) => {
            if (!identity || !attempt.costSnapshot) {
              throw new Error("Copilot model attempts require an immutable cost snapshot");
            }
            return LlmCallCostRecordSchema.parse({
              id: crypto.randomUUID(),
              agent_run_id: input.id,
              identity,
              attempt_index: index + 1,
              provider: attempt.costSnapshot.provider,
              model: attempt.costSnapshot.model,
              effort: attempt.costSnapshot.effort,
              status: attempt.status,
              input_tokens: attempt.costSnapshot.inputTokens,
              cached_input_tokens: attempt.costSnapshot.cachedInputTokens,
              output_tokens: attempt.costSnapshot.outputTokens,
              input_price_per_million_usd: Number(attempt.costSnapshot.inputPricePerMillionUsd),
              cached_input_price_per_million_usd: Number(
                attempt.costSnapshot.cachedInputPricePerMillionUsd,
              ),
              output_price_per_million_usd: Number(attempt.costSnapshot.outputPricePerMillionUsd),
              cost_usd: Number(attempt.costSnapshot.costUsd),
              fallback_triggered: attempt.costSnapshot.fallbackTriggered,
              latency_ms: attempt.latencyMs,
              failure_class:
                attempt.status === "failed" ? (attempt.failureClass ?? "provider_error") : null,
              created_at: createdAt.toISOString(),
              retention_expires_at: retentionDeadline(createdAt, retention.costDays).toISOString(),
            });
          })
        : [];

      await db.transaction(async (tx) => {
        await tx.insert(agentRuns).values({
          id: input.id,
          userId: identity?.user_id ?? null,
          anonId: identity?.anon_id ?? null,
          tripId: input.tripId ?? null,
          intent: input.intent ?? null,
          status: input.status,
          inputDigest: input.inputDigest,
          outputDigest: input.outputDigest ?? null,
          modelProvider: primaryAttempt?.provider ?? null,
          model: primaryAttempt?.model ?? null,
          effort: primaryAttempt?.costSnapshot?.effort ?? null,
          inputTokens,
          outputTokens,
          costUsd,
          latencyMs: input.latencyMs,
          attemptsJsonb: attempts,
          fallbackUsed:
            attempts.length > 1 ||
            attempts.some((attempt) => attempt.costSnapshot?.fallbackTriggered),
          validationStatus: input.validationStatus,
          repairCount: input.repairCount,
          failureClass: input.failureClass ?? null,
          completedAt: sql`now()`,
        });

        if (input.toolCalls?.length) {
          await tx.insert(toolCalls).values(
            input.toolCalls.map((toolCall) => ({
              agentRunId: input.id,
              toolName: toolCall.toolName,
              status: toolCall.status,
              inputDigest: toolCall.inputDigest ?? null,
              outputDigest: toolCall.outputDigest ?? null,
              latencyMs: toolCall.latencyMs,
              failureClass: toolCall.failureClass ?? null,
              completedAt: sql`now()`,
            })),
          );
        }

        if (!conversation || !identity) return;

        await tx.insert(copilotConversationTurns).values({
          id: conversation.id,
          sessionId: conversation.session_id,
          agentRunId: conversation.agent_run_id,
          userId: conversation.identity.user_id,
          anonId: conversation.identity.anon_id,
          status: conversation.status,
          userMessage: conversation.user_message,
          assistantEnvelopeJsonb: conversation.assistant_envelope,
          cityIntent: conversation.city_intent,
          redactionClassesJsonb: conversation.redaction_classes,
          failureClass: conversation.failure_class,
          retentionExpiresAt: new Date(conversation.retention_expires_at),
          createdAt: new Date(conversation.created_at),
        });

        if (costRecords.length > 0) {
          await tx.insert(llmCallCosts).values(
            costRecords.map((record) => {
              const snapshot = attempts[record.attempt_index - 1]!.costSnapshot!;
              return {
                id: record.id,
                agentRunId: record.agent_run_id,
                userId: record.identity.user_id,
                anonId: record.identity.anon_id,
                attemptIndex: record.attempt_index,
                provider: record.provider,
                model: record.model,
                effort: record.effort,
                status: record.status,
                inputTokens: record.input_tokens,
                cachedInputTokens: record.cached_input_tokens,
                outputTokens: record.output_tokens,
                inputPricePerMillionUsd: snapshot.inputPricePerMillionUsd,
                cachedInputPricePerMillionUsd: snapshot.cachedInputPricePerMillionUsd,
                outputPricePerMillionUsd: snapshot.outputPricePerMillionUsd,
                costUsd: snapshot.costUsd,
                fallbackTriggered: record.fallback_triggered,
                latencyMs: record.latency_ms,
                failureClass: record.failure_class,
                retentionExpiresAt: new Date(record.retention_expires_at),
                createdAt: new Date(record.created_at),
              };
            }),
          );
        }

        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${conversation.session_id}, 0))`,
        );
        const existingSession = await tx
          .select({ id: telemetryEvents.id })
          .from(telemetryEvents)
          .where(
            and(
              eq(telemetryEvents.action, "session_started"),
              eq(telemetryEvents.entityId, conversation.session_id),
            ),
          )
          .limit(1);

        const events = [];
        const eventIntent = CopilotIntentSchema.safeParse(input.intent).data;
        if (existingSession.length === 0) {
          events.push(
            prepareProductEvent({
              identity: input.identity!,
              action: "session_started",
              entityType: "copilot_session",
              entityId: conversation.session_id,
              createdAt,
              retentionDays: retention.eventDays,
            }),
          );
        }
        events.push(
          prepareProductEvent({
            identity: input.identity!,
            action: input.status === "succeeded" ? "turn_completed" : "model_failure",
            entityType: "copilot_turn",
            entityId: input.id,
            ...(eventIntent ? { intent: eventIntent } : {}),
            props:
              input.status === "failed"
                ? { failureClass: input.failureClass ?? "internal_error" }
                : {},
            createdAt,
            retentionDays: retention.eventDays,
          }),
        );

        attempts.forEach((attempt, index) => {
          if (attempt.costSnapshot?.fallbackTriggered) {
            events.push(
              prepareProductEvent({
                identity: input.identity!,
                action: "fallback_triggered",
                entityType: "model_attempt",
                entityId: `${input.id}:${index + 1}`,
                ...(eventIntent ? { intent: eventIntent } : {}),
                props: {
                  provider: attempt.provider,
                  model: attempt.model,
                  attemptIndex: index + 1,
                },
                createdAt,
                retentionDays: retention.eventDays,
              }),
            );
          }
          if (attempt.costSnapshot?.pricingMissing) {
            events.push(
              prepareProductEvent({
                identity: input.identity!,
                action: "cost_pricing_missing",
                entityType: "model_attempt",
                entityId: `${input.id}:${index + 1}`,
                ...(eventIntent ? { intent: eventIntent } : {}),
                props: {
                  provider: attempt.provider,
                  model: attempt.model,
                  attemptIndex: index + 1,
                },
                createdAt,
                retentionDays: retention.eventDays,
              }),
            );
          }
        });

        await tx.insert(telemetryEvents).values(events.map(toEventInsert));
      });
    },

    async recordProductEvent(input) {
      const retention = resolveCopilotRetentionPolicy();
      const event = prepareProductEvent({
        ...input,
        createdAt: input.createdAt ?? new Date(),
        retentionDays: retention.eventDays,
      });
      await db.insert(telemetryEvents).values(toEventInsert(event));
    },
  };
}

function prepareProductEvent(
  input: RecordCopilotProductEventInput & { createdAt: Date; retentionDays: number },
) {
  assertSafeEventEntityId(input.entityType, input.entityId);
  const identity = identityRecord(input.identity);
  return CopilotProductEventSchema.parse({
    id: crypto.randomUUID(),
    user_id: identity.user_id ?? undefined,
    anon_id: identity.anon_id ?? undefined,
    surface: "server",
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    intent: input.intent,
    props_jsonb: input.props ?? {},
    created_at: input.createdAt.toISOString(),
    retention_expires_at: retentionDeadline(input.createdAt, input.retentionDays).toISOString(),
  });
}

function toEventInsert(event: ReturnType<typeof prepareProductEvent>) {
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

function sumCostUsd(values: string[], scale: number): string {
  const sourceScale = 8;
  const total = values.reduce((sum, value) => sum + parseFixed(value, sourceScale), 0n);
  const divisor = 10n ** BigInt(sourceScale - scale);
  const rounded = (total + divisor / 2n) / divisor;
  const digits = rounded.toString().padStart(scale + 1, "0");
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function parseFixed(value: string, scale: number): bigint {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match || (match[2]?.length ?? 0) > scale) {
    throw new Error("Invalid fixed-point cost snapshot");
  }
  return BigInt(`${match[1]}${(match[2] ?? "").padEnd(scale, "0")}`);
}

function assertSafeModelIdentifier(value: string, field: string, maxLength: number): string {
  if (
    value.length === 0 ||
    value.length > maxLength ||
    !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value) ||
    containsForbiddenConversationMaterial(value)
  ) {
    throw new Error(`Invalid ${field} identifier`);
  }
  return value;
}

function assertSafeEventEntityId(
  entityType: RecordCopilotProductEventInput["entityType"],
  entityId: string,
): void {
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
  const pattern =
    entityType === "model_attempt"
      ? new RegExp(`^${uuid}:[1-9]\\d*$`, "i")
      : new RegExp(`^${uuid}$`, "i");
  if (!pattern.test(entityId)) throw new Error("Invalid Copilot product event entity id");
}
