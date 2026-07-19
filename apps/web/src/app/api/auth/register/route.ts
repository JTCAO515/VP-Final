import { NextResponse } from "next/server";
import { z } from "zod";
import { applyIdentityCookies } from "../../../../lib/requestIdentity";
import { createSupabaseServerClient } from "../../../../lib/supabaseServer";

const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const cookieResponse = NextResponse.next();
  const parsed = RegisterRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email and a password of at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseServerClient(request, cookieResponse);
    const { data, error } = await supabase.auth.signUp(parsed.data);
    if (error || !data.user) {
      return applyIdentityCookies(
        NextResponse.json(
          {
            ok: false,
            error: "Your account could not be created. Check the details and try again.",
          },
          { status: 400 },
        ),
        cookieResponse,
      );
    }

    return applyIdentityCookies(
      NextResponse.json(
        {
          ok: true,
          confirmationRequired: data.session === null,
          user: { email: data.user.email ?? parsed.data.email },
        },
        { status: data.session === null ? 202 : 200 },
      ),
      cookieResponse,
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Account registration is temporarily unavailable." },
      { status: 503 },
    );
  }
}
