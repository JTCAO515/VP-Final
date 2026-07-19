import { isIP } from "node:net";
import { resolveRuntimeMode } from "@visepanda/app-server";

type Environment = Readonly<Record<string, string | undefined>>;

export class TrustedClientAddressUnavailableError extends Error {
  readonly code = "TRUSTED_CLIENT_ADDRESS_UNAVAILABLE";

  constructor(readonly reason: string) {
    super("A trusted client address is unavailable.");
    this.name = "TrustedClientAddressUnavailableError";
  }
}

export function resolveTrustedCopilotClientAddress(
  headers: Headers,
  environment: Environment,
): string {
  if (environment.VERCEL === "1") {
    const address = headers
      .get("x-vercel-forwarded-for")
      ?.split(",")
      .map((candidate) => candidate.trim())
      .map((candidate) => ({ candidate, version: isIP(candidate) }))
      .find(({ version }) => version !== 0);
    if (!address) throw new TrustedClientAddressUnavailableError("trusted_header_missing");
    return address.version === 6
      ? new URL(`http://[${address.candidate}]/`).hostname.slice(1, -1)
      : address.candidate;
  }

  const runtime = resolveRuntimeMode(environment);
  if (runtime.ok && (runtime.mode === "test" || runtime.mode === "local-demo")) {
    return "local-runtime";
  }
  throw new TrustedClientAddressUnavailableError("trusted_platform_unavailable");
}
