import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearPasswordRecoveryProof,
  readPasswordRecoveryProof,
} from "../../../../../lib/passwordRecovery";
import { applyIdentityCookies } from "../../../../../lib/requestIdentity";
import { createSupabaseServerClient } from "../../../../../lib/supabaseServer";

const PasswordUpdateSchema = z.object({
  password: z.string().min(8).max(128),
});

const invalidRecovery = () =>
  NextResponse.json(
    { ok: false, error: "This password recovery link is no longer valid. Request a new one." },
    { status: 401 },
  );

export async function POST(request: Request) {
  const parsed = PasswordUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Choose a password with at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    const proof = readPasswordRecoveryProof(request);
    if (!proof) return invalidRecovery();

    const cookieResponse = NextResponse.next();
    const supabase = createSupabaseServerClient(request, cookieResponse);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.id !== proof.userId) {
      const response = invalidRecovery();
      clearPasswordRecoveryProof(response);
      return response;
    }

    const updated = await supabase.auth.updateUser({ password: parsed.data.password });
    if (updated.error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Your password could not be updated. Try again or request a new link.",
        },
        { status: 400 },
      );
    }

    const response = applyIdentityCookies(NextResponse.json({ ok: true }), cookieResponse);
    clearPasswordRecoveryProof(response);
    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Password recovery is temporarily unavailable." },
      { status: 503 },
    );
  }
}
