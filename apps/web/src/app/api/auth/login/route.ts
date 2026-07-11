import { NextResponse } from "next/server";
import { z } from "zod";
import { applyIdentityCookies } from "../../../../lib/requestIdentity";
import { createSupabaseServerClient } from "../../../../lib/supabaseServer";

const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const cookieResponse = NextResponse.next();
  const parsed = LoginRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email and password." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseServerClient(request, cookieResponse);
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      return applyIdentityCookies(
        NextResponse.json({ ok: false, error: "Email or password is incorrect." }, { status: 401 }),
        cookieResponse,
      );
    }
    return applyIdentityCookies(
      NextResponse.json({ ok: true, user: { email: data.user.email ?? parsed.data.email } }),
      cookieResponse,
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Login is unavailable." },
      { status: 503 },
    );
  }
}
