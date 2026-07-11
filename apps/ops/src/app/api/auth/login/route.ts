import { OpsRoleSchema } from "@visepanda/app-server/ops-authorization";
import { NextResponse } from "next/server";
import { z } from "zod";
import { applyOpsCookies, getOpsAuthorizationService } from "../../../../lib/opsAccess";
import { createOpsSupabaseRequestClient } from "../../../../lib/supabaseServer";

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function POST(request: Request) {
  const parsed = LoginSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email and password." },
      { status: 400 },
    );
  }
  const cookieResponse = NextResponse.next();
  try {
    const supabase = createOpsSupabaseRequestClient(request, cookieResponse);
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      return applyOpsCookies(
        NextResponse.json({ ok: false, error: "Email or password is incorrect." }, { status: 401 }),
        cookieResponse,
      );
    }
    const access = await getOpsAuthorizationService().getAccess(data.user.id);
    if (!access) {
      await supabase.auth.signOut();
      return applyOpsCookies(
        NextResponse.json(
          { ok: false, error: "This account has no Ops membership." },
          { status: 403 },
        ),
        cookieResponse,
      );
    }
    return applyOpsCookies(
      NextResponse.json({ ok: true, role: OpsRoleSchema.parse(access.role) }),
      cookieResponse,
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Ops login is unavailable." },
      { status: 503 },
    );
  }
}
