import { createClient } from "@supabase/supabase-js";
import { TelemetryRateLimitUnavailableError } from "@visepanda/app-server";
import { NextResponse } from "next/server";

import { getServerCaller, getTelemetryRateLimiter } from "../../_server";
import {
  resolveTrustedClientAddress,
  TrustedClientAddressUnavailableError,
} from "../../copilot/trustedClient";
import { captureMobileTelemetry } from "../../../../lib/mobileTelemetryAccess";

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return unavailable();

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid mobile telemetry event." },
      { status: 400 },
    );
  }
  try {
    const result = await captureMobileTelemetry(request.headers.get("authorization"), payload, {
      async getUser(accessToken) {
        const { data, error } = await supabase.auth.getUser(accessToken);
        return error || !data.user ? null : { id: data.user.id };
      },
      async track(identity, event) {
        const limiter = getTelemetryRateLimiter();
        if (!limiter) throw new TelemetryRateLimitUnavailableError("limiter_not_configured");
        const admission = await limiter.check({
          subject: `user:${identity.userId}`,
          clientAddress: resolveTrustedClientAddress(request.headers, process.env),
        });
        if (!admission.allowed) {
          throw new MobileTelemetryRateLimitedError(admission.retryAfterSeconds);
        }
        await getServerCaller(identity).telemetry.trackMobile(event);
      },
    });
    return NextResponse.json(result, { status: result.ok ? 202 : result.status });
  } catch (error) {
    if (error instanceof MobileTelemetryRateLimitedError) {
      return NextResponse.json(
        {
          ok: false,
          code: "TELEMETRY_RATE_LIMITED",
          error: `Too many telemetry events were sent recently. Try again in ${error.retryAfterSeconds} seconds.`,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        { status: 429, headers: { "retry-after": String(error.retryAfterSeconds) } },
      );
    }
    if (
      error instanceof TelemetryRateLimitUnavailableError ||
      error instanceof TrustedClientAddressUnavailableError
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "TELEMETRY_RATE_LIMIT_UNAVAILABLE",
          error: "Telemetry protection is temporarily unavailable. Try again later.",
        },
        { status: 503 },
      );
    }
    return unavailable();
  }
}

function unavailable() {
  return NextResponse.json(
    { ok: false, error: "Mobile telemetry is temporarily unavailable." },
    { status: 503 },
  );
}

class MobileTelemetryRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Mobile telemetry is rate limited.");
  }
}
