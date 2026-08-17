import { NextResponse } from "next/server";
import { applyOpsCookies } from "../../../../lib/opsAccess";
import { createOpsSupabaseRequestClient } from "../../../../lib/supabaseServer";

export async function POST(request: Request) {
  const cookieResponse = NextResponse.next();
  try {
    const supabase = createOpsSupabaseRequestClient(request, cookieResponse);
    await supabase.auth.signOut();
    return applyOpsCookies(NextResponse.json({ ok: true }), cookieResponse);
  } catch {
    return NextResponse.json(
      { ok: false, error: "退出登录服务暂时不可用，请稍后重试。" },
      { status: 503 },
    );
  }
}
