import { NextResponse } from "next/server";
import { getServerCaller } from "../../_server";
import { runtimeUnavailableResponse } from "../../_runtimeError";
import { applyIdentityCookies, resolveRequestIdentity } from "../../../../lib/requestIdentity";

export async function POST(request: Request) {
  const cookieResponse = NextResponse.next();
  const identity = await resolveRequestIdentity(request, cookieResponse);
  try {
    const result = await getServerCaller(identity).trip.claimAnonymous();
    return applyIdentityCookies(NextResponse.json({ ok: true, ...result }), cookieResponse);
  } catch (error) {
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) return applyIdentityCookies(unavailable, cookieResponse);
    return applyIdentityCookies(
      NextResponse.json(
        { ok: false, error: "Sign in from the same browser to keep anonymous trips." },
        { status: 401 },
      ),
      cookieResponse,
    );
  }
}
