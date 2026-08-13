import {
  MobileTripListResponseSchema,
  type MobileTripListResponse,
  type ReadOnlyTripSnapshot,
} from "@visepanda/domain";

export type MobileVerifiedUser = { id: string; email?: string };

export async function listMobileTrips(
  authorization: string | null,
  dependencies: {
    getUser(accessToken: string): Promise<MobileVerifiedUser | null>;
    listTrips(identity: {
      kind: "authenticated";
      userId: string;
      email?: string;
    }): Promise<ReadonlyArray<ReadOnlyTripSnapshot>>;
  },
): Promise<MobileTripListResponse | { ok: false; status: 401 | 503; error: string }> {
  const accessToken = readBearerToken(authorization);
  if (!accessToken) return { ok: false, status: 401, error: "Sign in is required to load Trips." };

  try {
    const user = await dependencies.getUser(accessToken);
    if (!user) return { ok: false, status: 401, error: "Your mobile session is no longer valid." };
    return MobileTripListResponseSchema.parse({
      ok: true,
      trips: await dependencies.listTrips({
        kind: "authenticated",
        userId: user.id,
        ...(user.email ? { email: user.email } : {}),
      }),
    });
  } catch {
    return { ok: false, status: 503, error: "Trip sync is temporarily unavailable." };
  }
}

function readBearerToken(authorization: string | null): string | null {
  const match = authorization?.match(/^Bearer ([A-Za-z0-9._~+/=-]{20,})$/);
  return match?.[1] ?? null;
}
