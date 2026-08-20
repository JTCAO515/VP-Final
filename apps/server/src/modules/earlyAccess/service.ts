import {
  EarlyAccessSignupInputSchema,
  EarlyAccessSignupResultSchema,
  type EarlyAccessSignupInput,
  type EarlyAccessSignupResult,
} from "@visepanda/domain";

export const EARLY_ACCESS_RETENTION_DAYS = 365;
export const EARLY_ACCESS_USER_AGENT_MAX_LENGTH = 512;

export type EarlyAccessSignupMetadata = {
  ipHash: string;
  userAgent?: string;
};

export type EarlyAccessSignupService = {
  submit(
    input: EarlyAccessSignupInput,
    metadata: EarlyAccessSignupMetadata,
  ): Promise<EarlyAccessSignupResult>;
};

export function normalizeEarlyAccessUserAgent(value: string | null): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, EARLY_ACCESS_USER_AGENT_MAX_LENGTH);
}

export function createInMemoryEarlyAccessSignupService(): EarlyAccessSignupService {
  const signups = new Map<
    string,
    { input: EarlyAccessSignupInput; metadata: EarlyAccessSignupMetadata }
  >();
  return {
    async submit(input, metadata) {
      const parsed = EarlyAccessSignupInputSchema.parse(input);
      if (signups.has(parsed.email)) {
        return EarlyAccessSignupResultSchema.parse({ status: "already_subscribed" });
      }
      signups.set(parsed.email, { input: parsed, metadata });
      return EarlyAccessSignupResultSchema.parse({ status: "subscribed" });
    },
  };
}
