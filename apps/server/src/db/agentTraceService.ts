import { sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { agentRuns, toolCalls } from "./schema.js";
import type { AgentTraceService } from "../modules/trace/service.js";

export function createDbAgentTraceService(db: Db): AgentTraceService {
  return {
    async recordRun(input) {
      const attempts = input.attempts.map((attempt) => ({ ...attempt }));
      const inputTokens = attempts.reduce((sum, attempt) => sum + attempt.inputTokens, 0);
      const outputTokens = attempts.reduce((sum, attempt) => sum + attempt.outputTokens, 0);
      const costUsd = attempts.reduce((sum, attempt) => sum + attempt.costUsd, 0);
      const primaryAttempt = attempts.at(-1);
      await db.transaction(async (tx) => {
        await tx.insert(agentRuns).values({
          id: input.id,
          userId: input.identity?.kind === "authenticated" ? input.identity.userId : null,
          anonId: input.identity?.kind === "anonymous" ? input.identity.anonId : null,
          tripId: input.tripId ?? null,
          intent: input.intent ?? null,
          status: input.status,
          inputDigest: input.inputDigest,
          outputDigest: input.outputDigest ?? null,
          modelProvider: primaryAttempt?.provider ?? null,
          model: primaryAttempt?.model ?? null,
          inputTokens,
          outputTokens,
          costUsd: costUsd.toFixed(6),
          latencyMs: input.latencyMs,
          attemptsJsonb: attempts,
          fallbackUsed: attempts.length > 1,
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
      });
    },
  };
}
