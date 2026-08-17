import { OpsRoleSchema } from "@visepanda/app-server/ops-authorization";
import { NextResponse } from "next/server";
import { z } from "zod";
import { applyOpsCookies, getOpsAuthorizationService } from "../../../../lib/opsAccess";
import { createOpsSupabaseRequestClient } from "../../../../lib/supabaseServer";

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function POST(request: Request) {
  const parsed = LoginSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "请输入有效的邮箱和密码。" }, { status: 400 });
  }
  const cookieResponse = NextResponse.next();
  try {
    const supabase = createOpsSupabaseRequestClient(request, cookieResponse);
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      return applyOpsCookies(
        NextResponse.json({ ok: false, error: "邮箱或密码不正确。" }, { status: 401 }),
        cookieResponse,
      );
    }
    const access = await getOpsAuthorizationService().getAccess(data.user.id);
    if (!access) {
      await supabase.auth.signOut();
      return applyOpsCookies(
        NextResponse.json({ ok: false, error: "此账号没有运营后台成员资格。" }, { status: 403 }),
        cookieResponse,
      );
    }
    return applyOpsCookies(
      NextResponse.json({ ok: true, role: OpsRoleSchema.parse(access.role) }),
      cookieResponse,
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "登录服务暂时不可用，请稍后重试。" },
      { status: 503 },
    );
  }
}
