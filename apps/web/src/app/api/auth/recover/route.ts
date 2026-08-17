import { NextResponse } from "next/server";
import { z } from "zod";
import { configuredPasswordRecoveryRedirect } from "../../../../lib/passwordRecovery";
import { createSupabaseServerClient } from "../../../../lib/supabaseServer";

const PasswordRecoveryRequestSchema = z.object({
  email: z.string().trim().email().max(320),
});

const unavailable = () =>
  NextResponse.json(
    { ok: false, error: "Password recovery is temporarily unavailable." },
    { status: 503 },
  );

export async function POST(request: Request) {
  const parsed = PasswordRecoveryRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const redirectTo = configuredPasswordRecoveryRedirect(request);
    const response = NextResponse.next();
    const supabase = createSupabaseServerClient(request, response);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
    if (error) return unavailable();

    // This deliberately does not expose whether the account exists.
    return NextResponse.json({ ok: true });
  } catch {
    return unavailable();
  }
}
