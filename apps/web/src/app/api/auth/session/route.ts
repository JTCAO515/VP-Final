import { NextResponse } from "next/server";
import { applyIdentityCookies, resolveRequestIdentity } from "../../../../lib/requestIdentity";

export async function GET(request: Request) {
  const cookieResponse = NextResponse.next();
  try {
    const identity = await resolveRequestIdentity(request, cookieResponse);
    const body =
      identity.kind === "authenticated"
        ? { ok: true, authenticated: true, user: { email: identity.email ?? null } }
        : { ok: true, authenticated: false, user: null };
    return applyIdentityCookies(NextResponse.json(body), cookieResponse);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Session is unavailable." },
      { status: 503 },
    );
  }
}
