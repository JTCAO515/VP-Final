import { TelemetryCaptureInputSchema } from "@visepanda/domain";
import { TelemetryRateLimitUnavailableError, type RequestIdentity } from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { getServerCaller, getTelemetryRateLimiter } from "../_server";
import { runtimeUnavailableResponse } from "../_runtimeError";
import { applyIdentityCookies, resolveRequestIdentity } from "../../../lib/requestIdentity";
import {
  resolveTrustedClientAddress,
  TrustedClientAddressUnavailableError,
} from "../copilot/trustedClient";

export async function POST(request: Request) {
  const cookieResponse = NextResponse.next();
  try {
    const identity = await resolveRequestIdentity(request, cookieResponse);
    const parsed = TelemetryCaptureInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return applyIdentityCookies(
        NextResponse.json({ ok: false, error: "Invalid telemetry event." }, { status: 400 }),
        cookieResponse,
      );
    }

    const limiter = getTelemetryRateLimiter();
    if (!limiter) throw new TelemetryRateLimitUnavailableError("limiter_not_configured");
    const admission = await limiter.check({
      subject: telemetryRateLimitSubject(identity),
      clientAddress: resolveTrustedClientAddress(request.headers, process.env),
    });
    if (!admission.allowed) {
      console.warn("telemetry_rate_limited", { rejectionCount: admission.rejectionCount });
      return applyIdentityCookies(
        NextResponse.json(
          {
            ok: false,
            code: "TELEMETRY_RATE_LIMITED",
            error: `Too many telemetry events were sent recently. Try again in ${admission.retryAfterSeconds} seconds.`,
            retryAfterSeconds: admission.retryAfterSeconds,
          },
          { status: 429, headers: { "retry-after": String(admission.retryAfterSeconds) } },
        ),
        cookieResponse,
      );
    }

    await getServerCaller(identity).telemetry.track(parsed.data);
    return applyIdentityCookies(NextResponse.json({ ok: true }, { status: 202 }), cookieResponse);
  } catch (error) {
    const rateLimitUnavailable = findError(error, TelemetryRateLimitUnavailableError);
    const trustedAddressUnavailable = findError(error, TrustedClientAddressUnavailableError);
    if (rateLimitUnavailable || trustedAddressUnavailable) {
      console.warn("telemetry_rate_limit_unavailable", {
        reason: rateLimitUnavailable?.reason ?? trustedAddressUnavailable?.reason,
      });
      return applyIdentityCookies(
        NextResponse.json(
          {
            ok: false,
            code: "TELEMETRY_RATE_LIMIT_UNAVAILABLE",
            error: "Telemetry protection is temporarily unavailable. Try again later.",
          },
          { status: 503 },
        ),
        cookieResponse,
      );
    }
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) return applyIdentityCookies(unavailable, cookieResponse);
    console.warn("telemetry_capture_failed", { failureClass: "persistence_error" });
    return applyIdentityCookies(
      NextResponse.json(
        { ok: false, error: "Telemetry is temporarily unavailable." },
        { status: 503 },
      ),
      cookieResponse,
    );
  }
}

function telemetryRateLimitSubject(identity: RequestIdentity): string {
  if (identity.kind === "authenticated") return `user:${identity.userId}`;
  if (identity.kind === "anonymous") return `anon:${identity.anonId}`;
  throw new TelemetryRateLimitUnavailableError("trusted_identity_unavailable");
}

function findError<T extends Error>(
  error: unknown,
  errorType: abstract new (...args: never[]) => T,
): T | null {
  if (error instanceof errorType) return error;
  if (error && typeof error === "object" && "cause" in error) {
    return findError((error as { cause?: unknown }).cause, errorType);
  }
  return null;
}
