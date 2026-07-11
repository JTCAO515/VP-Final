import { NextResponse } from "next/server";
import { getServerCaller } from "../../../_server";
import { runtimeUnavailableResponse } from "../../../_runtimeError";
import { applyIdentityCookies, resolveRequestIdentity } from "../../../../../lib/requestIdentity";

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const cookieResponse = NextResponse.next();
  const identity = await resolveRequestIdentity(request, cookieResponse);
  const { tripId } = await context.params;
  try {
    const result = await getServerCaller(identity).trip.createShareToken({ id: tripId });
    const response = result
      ? NextResponse.json({
          ok: true,
          token: result.token,
          url: `/share/trips/${encodeURIComponent(result.token)}`,
        })
      : NextResponse.json({ ok: false, error: "Trip not found." }, { status: 404 });
    return applyIdentityCookies(response, cookieResponse);
  } catch (error) {
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) return applyIdentityCookies(unavailable, cookieResponse);
    throw error;
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const cookieResponse = NextResponse.next();
  const identity = await resolveRequestIdentity(request, cookieResponse);
  const { tripId } = await context.params;
  try {
    const revoked = await getServerCaller(identity).trip.revokeShareToken({ id: tripId });
    return applyIdentityCookies(
      revoked
        ? NextResponse.json({ ok: true, revoked: true })
        : NextResponse.json({ ok: false, error: "Trip not found." }, { status: 404 }),
      cookieResponse,
    );
  } catch (error) {
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) return applyIdentityCookies(unavailable, cookieResponse);
    throw error;
  }
}
