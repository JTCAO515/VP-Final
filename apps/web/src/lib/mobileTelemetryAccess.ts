import {
  MobileTelemetryCaptureInputSchema,
  type MobileTelemetryCaptureInput,
} from "@visepanda/domain";

export type MobileTelemetryVerifiedUser = { id: string };

export async function captureMobileTelemetry(
  authorization: string | null,
  input: unknown,
  dependencies: {
    getUser(accessToken: string): Promise<MobileTelemetryVerifiedUser | null>;
    track(
      identity: { kind: "authenticated"; userId: string },
      event: MobileTelemetryCaptureInput,
    ): Promise<void>;
  },
): Promise<{ ok: true } | { ok: false; status: 400 | 401 | 503; error: string }> {
  const accessToken = readBearerToken(authorization);
  if (!accessToken)
    return { ok: false, status: 401, error: "Sign in is required to record mobile telemetry." };

  const parsed = MobileTelemetryCaptureInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: "Invalid mobile telemetry event." };

  let user: MobileTelemetryVerifiedUser | null;
  try {
    user = await dependencies.getUser(accessToken);
  } catch {
    return { ok: false, status: 503, error: "Mobile telemetry is temporarily unavailable." };
  }
  if (!user) return { ok: false, status: 401, error: "Your mobile session is no longer valid." };
  await dependencies.track({ kind: "authenticated", userId: user.id }, parsed.data);
  return { ok: true };
}

function readBearerToken(authorization: string | null): string | null {
  const match = authorization?.match(/^Bearer ([A-Za-z0-9._~+/=-]{20,})$/);
  return match?.[1] ?? null;
}
