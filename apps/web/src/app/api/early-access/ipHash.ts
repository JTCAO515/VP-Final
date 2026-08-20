import { createHmac } from "node:crypto";

export class EarlyAccessIpHashUnavailableError extends Error {
  readonly code = "EARLY_ACCESS_IP_HASH_UNAVAILABLE";

  constructor() {
    super("Early Access IP hashing is unavailable.");
  }
}

export function hashEarlyAccessClientAddress(
  clientAddress: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const hashSalt = environment.VISEPANDA_IP_HASH_SALT?.trim();
  if (!hashSalt || hashSalt.length < 32) throw new EarlyAccessIpHashUnavailableError();
  return createHmac("sha256", hashSalt).update(`early-access:${clientAddress}`).digest("hex");
}
