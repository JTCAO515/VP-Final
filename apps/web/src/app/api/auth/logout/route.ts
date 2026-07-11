import { NextResponse } from "next/server";
import { applyIdentityCookies } from "../../../../lib/requestIdentity";
import { createSupabaseServerClient } from "../../../../lib/supabaseServer";

export async function POST(request: Request) {
  const cookieResponse = NextResponse.next();
  try {
    const supabase = createSupabaseServerClient(request, cookieResponse);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return applyIdentityCookies(NextResponse.json({ ok: true }), cookieResponse);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Logout is unavailable." },
      { status: 503 },
    );
  }
}
