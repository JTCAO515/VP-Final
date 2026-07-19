import { CopilotEnvelopeSchema } from "@visepanda/domain";
import {
  AnonymousTurnCapacityReservedError,
  AnonymousTurnControlUnavailableError,
  AnonymousTurnLimitExceededError,
  CopilotIpRateLimitUnavailableError,
  TripVersionConflictError,
} from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCopilotIpRateLimiter, getServerCaller } from "../_server";
import { runtimeUnavailableResponse } from "../_runtimeError";
import { applyIdentityCookies, resolveRequestIdentity } from "../../../lib/requestIdentity";
import { findModelFailure, summarizeModelFailure } from "./modelFailure";
import {
  resolveTrustedCopilotClientAddress,
  TrustedClientAddressUnavailableError,
} from "./trustedClient";

const CopilotRequestSchema = z.object({
  message: z.string().min(1),
  tripId: z.string().uuid().optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request) {
  const cookieResponse = NextResponse.next();
  const identity = await resolveRequestIdentity(request, cookieResponse);
  const parsed = CopilotRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return applyIdentityCookies(
      NextResponse.json({ ok: false, error: "Invalid Copilot request." }, { status: 400 }),
      cookieResponse,
    );
  }

  try {
    const clientAddress = resolveTrustedCopilotClientAddress(request.headers, process.env);
    const limiter = getCopilotIpRateLimiter();
    if (!limiter) throw new CopilotIpRateLimitUnavailableError("limiter_not_configured");
    const admission = await limiter.check(clientAddress);
    if (!admission.allowed) {
      const retryAfterSeconds = admission.retryAfterSeconds;
      return applyIdentityCookies(
        NextResponse.json(
          {
            ok: false,
            code: "COPILOT_IP_RATE_LIMITED",
            error: `This network has sent too many Copilot requests. Try again in ${retryAfterSeconds} seconds.`,
            retryAfterSeconds,
          },
          { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
        ),
        cookieResponse,
      );
    }
    const result = await getServerCaller(identity).copilot.run(parsed.data);
    const envelope = CopilotEnvelopeSchema.parse(result.envelope);
    const emptyDays = result.trip?.days.filter((day) => day.blocks.length === 0).length ?? 0;

    return applyIdentityCookies(
      NextResponse.json({
        ok: true,
        envelope,
        trip: result.trip,
        version: result.version,
        trace: result.trace,
        anonymousUsage: result.anonymousUsage,
        progress: {
          status: emptyDays > 0 ? "skeleton" : "completed",
          completedDays: (result.trip?.days.length ?? 0) - emptyDays,
          totalDays: result.trip?.days.length ?? 0,
          attempts: 0,
          error: null,
        },
      }),
      cookieResponse,
    );
  } catch (error) {
    const rateLimitUnavailable = findError(error, CopilotIpRateLimitUnavailableError);
    const trustedAddressUnavailable = findError(error, TrustedClientAddressUnavailableError);
    if (rateLimitUnavailable || trustedAddressUnavailable) {
      console.warn("copilot_ip_rate_limit_unavailable", {
        reason: rateLimitUnavailable?.reason ?? trustedAddressUnavailable?.reason,
      });
      return applyIdentityCookies(
        NextResponse.json(
          {
            ok: false,
            code: "COPILOT_IP_RATE_LIMIT_UNAVAILABLE",
            error: "Copilot request protection is temporarily unavailable. Try again later.",
          },
          { status: 503 },
        ),
        cookieResponse,
      );
    }
    const capacityReserved = findError(error, AnonymousTurnCapacityReservedError);
    if (capacityReserved) {
      return applyIdentityCookies(
        NextResponse.json(
          {
            ok: false,
            code: capacityReserved.code,
            error: "Another anonymous Copilot question is still finishing. Try again shortly.",
            anonymousUsage: capacityReserved.usage,
          },
          { status: 409 },
        ),
        cookieResponse,
      );
    }
    const turnLimit = findError(error, AnonymousTurnLimitExceededError);
    if (turnLimit) {
      return applyIdentityCookies(
        NextResponse.json(
          {
            ok: false,
            code: turnLimit.code,
            error: "Sign in to continue using the Copilot.",
            anonymousUsage: turnLimit.usage,
          },
          { status: 403 },
        ),
        cookieResponse,
      );
    }
    const turnControl = findError(error, AnonymousTurnControlUnavailableError);
    if (turnControl) {
      console.warn("anonymous_turn_control_unavailable", { reason: turnControl.reason });
      return applyIdentityCookies(
        NextResponse.json(
          {
            ok: false,
            code: turnControl.code,
            error:
              "Anonymous Copilot access is temporarily unavailable. Sign in or try again later.",
          },
          { status: 503 },
        ),
        cookieResponse,
      );
    }
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) return applyIdentityCookies(unavailable, cookieResponse);
    const modelFailure = findModelFailure(error);
    if (modelFailure) {
      const diagnostic = summarizeModelFailure(error);
      if (diagnostic) console.warn("copilot_model_provider_failure", diagnostic);
      return applyIdentityCookies(
        NextResponse.json(
          {
            ok: false,
            code: modelFailure.code,
            error:
              modelFailure.code === "MODEL_CONFIGURATION_UNAVAILABLE"
                ? "Copilot is unavailable because its model provider configuration is incomplete."
                : "Copilot is temporarily unavailable because its model providers could not respond.",
          },
          { status: 503 },
        ),
        cookieResponse,
      );
    }
    const conflict = findTripConflict(error);
    return applyIdentityCookies(
      NextResponse.json(
        {
          ok: false,
          error: conflict
            ? "This trip changed in another session. Reload it before trying again."
            : error instanceof Error
              ? error.message
              : "Copilot request failed.",
          ...(conflict ? { code: conflict.code, currentVersion: conflict.currentVersion } : {}),
        },
        { status: conflict ? 409 : 502 },
      ),
      cookieResponse,
    );
  }
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

function findTripConflict(error: unknown): TripVersionConflictError | null {
  if (error instanceof TripVersionConflictError) return error;
  if (error && typeof error === "object" && "cause" in error) {
    const cause = (error as { cause?: unknown }).cause;
    if (cause instanceof TripVersionConflictError) return cause;
  }
  return null;
}
