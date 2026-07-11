import { NextResponse } from "next/server";
import { applyOpsCookies, getOpsAuthorizationService } from "../../../../lib/opsAccess";
import { createOpsSupabaseRequestClient } from "../../../../lib/supabaseServer";

export async function GET(request: Request) {
  const cookieResponse = NextResponse.next();
  try {
    const supabase = createOpsSupabaseRequestClient(request, cookieResponse);
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return applyOpsCookies(
        NextResponse.json({ ok: true, authenticated: false, access: null }),
        cookieResponse,
      );
    }
    const access = await getOpsAuthorizationService().getAccess(data.user.id);
    return applyOpsCookies(
      NextResponse.json({ ok: true, authenticated: true, access }),
      cookieResponse,
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Ops session is unavailable." },
      { status: 503 },
    );
  }
}
