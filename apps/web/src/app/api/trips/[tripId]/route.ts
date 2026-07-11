import { TripPatchSchema } from "@visepanda/domain";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerCaller } from "../../_server";
import { runtimeUnavailableResponse } from "../../_runtimeError";
import { applyIdentityCookies, resolveRequestIdentity } from "../../../../lib/requestIdentity";

const UpdateTripSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  patch: TripPatchSchema,
});

export async function GET(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const cookieResponse = NextResponse.next();
  const identity = await resolveRequestIdentity(request, cookieResponse);
  const { tripId } = await context.params;
  try {
    const snapshot = await getServerCaller(identity).trip.get({ id: tripId });
    const response = snapshot
      ? NextResponse.json({ ok: true, trip: snapshot.trip, version: snapshot.version })
      : NextResponse.json({ ok: false, error: "Trip not found." }, { status: 404 });
    return applyIdentityCookies(response, cookieResponse);
  } catch (error) {
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) return applyIdentityCookies(unavailable, cookieResponse);
    throw error;
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const cookieResponse = NextResponse.next();
  const identity = await resolveRequestIdentity(request, cookieResponse);
  const { tripId } = await context.params;
  const parsed = UpdateTripSchema.safeParse(await request.json());
  if (!parsed.success) {
    return applyIdentityCookies(
      NextResponse.json({ ok: false, error: "Invalid trip update." }, { status: 400 }),
      cookieResponse,
    );
  }

  try {
    const snapshot = await getServerCaller(identity).trip.applyPatch({
      id: tripId,
      ...parsed.data,
    });
    const response = snapshot
      ? NextResponse.json({ ok: true, trip: snapshot.trip, version: snapshot.version })
      : NextResponse.json({ ok: false, error: "Trip not found." }, { status: 404 });
    return applyIdentityCookies(response, cookieResponse);
  } catch (error) {
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) return applyIdentityCookies(unavailable, cookieResponse);
    const currentVersion = readCurrentVersion(error);
    return applyIdentityCookies(
      NextResponse.json(
        {
          ok: false,
          error:
            currentVersion === null ? "Trip update failed." : "Trip changed. Reload and retry.",
          ...(currentVersion === null ? {} : { code: "TRIP_VERSION_CONFLICT", currentVersion }),
        },
        { status: currentVersion !== null ? 409 : 502 },
      ),
      cookieResponse,
    );
  }
}

function readCurrentVersion(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("cause" in error)) return null;
  const cause = (error as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object" || !("currentVersion" in cause)) return null;
  const value = (cause as { currentVersion?: unknown }).currentVersion;
  return typeof value === "number" ? value : null;
}
