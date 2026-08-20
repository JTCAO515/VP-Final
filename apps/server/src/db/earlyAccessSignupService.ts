import {
  EarlyAccessSignupInputSchema,
  EarlyAccessSignupResultSchema,
  type EarlyAccessSignupInput,
  type EarlyAccessSignupResult,
} from "@visepanda/domain";
import type { Db } from "./client.js";
import { earlyAccessSignups } from "./schema.js";
import {
  EARLY_ACCESS_RETENTION_DAYS,
  type EarlyAccessSignupMetadata,
  type EarlyAccessSignupService,
} from "../modules/earlyAccess/service.js";

export function createDbEarlyAccessSignupService(
  db: Db,
  options: { now?: () => Date } = {},
): EarlyAccessSignupService {
  const now = options.now ?? (() => new Date());
  return {
    async submit(input, metadata) {
      const parsed = EarlyAccessSignupInputSchema.parse(input);
      const createdAt = now();
      const [row] = await db
        .insert(earlyAccessSignups)
        .values({
          ...parsed,
          ipHash: metadata.ipHash,
          ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
          createdAt,
          retentionExpiresAt: retentionDeadline(createdAt),
        })
        .onConflictDoNothing({ target: earlyAccessSignups.email })
        .returning({ id: earlyAccessSignups.id });
      return EarlyAccessSignupResultSchema.parse({
        status: row ? "subscribed" : "already_subscribed",
      });
    },
  };
}

function retentionDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + EARLY_ACCESS_RETENTION_DAYS * 24 * 60 * 60 * 1_000);
}
