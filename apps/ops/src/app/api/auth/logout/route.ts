import { NextResponse } from "next/server";
import { applyOpsCookies } from "../../../../lib/opsAccess";
import { createOpsSupabaseRequestClient } from "../../../../lib/supabaseServer";

export async function POST(request: Request) {
  const cookieResponse = NextResponse.next();
  try {
    const supabase = createOpsSupabaseRequestClient(request, cookieResponse);
    await supabase.auth.signOut();
    return applyOpsCookies(NextResponse.json({ ok: true }), cookieResponse);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Ops logout is unavailable." },
      { status: 503 },
    );
  }
}
