import {
  OpsForbiddenError,
  OpsUnauthorizedError,
  type OpsAccess,
  type OpsAuthorizationService,
  type OpsPermission,
} from "@visepanda/app-server/ops-authorization";
import { createDb } from "@visepanda/app-server/db";
import { createDbOpsAuthorizationService } from "@visepanda/app-server/db-ops-authorization";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createOpsSupabaseRequestClient } from "./supabaseServer";

export type AuthorizedOpsRequest = {
  access: OpsAccess;
  authorizationService: OpsAuthorizationService;
  cookieResponse: NextResponse;
};

export async function authorizeOpsRequest(
  request: Request,
  permission: OpsPermission,
  dependencies?: {
    getUser: () => Promise<{ id: string } | null>;
    authorizationService: OpsAuthorizationService;
  },
): Promise<AuthorizedOpsRequest | NextResponse> {
  const cookieResponse = NextResponse.next();
  try {
    const user = dependencies
      ? await dependencies.getUser()
      : (await createOpsSupabaseRequestClient(request, cookieResponse).auth.getUser()).data.user;
    if (!user) throw new OpsUnauthorizedError();
    const authorizationService = dependencies?.authorizationService ?? getOpsAuthorizationService();
    const access = await authorizationService.getAccess(user.id);
    if (!access || !access.permissions.includes(permission)) throw new OpsForbiddenError();
    return { access, authorizationService, cookieResponse };
  } catch (error) {
    const status =
      error instanceof OpsUnauthorizedError ? 401 : error instanceof OpsForbiddenError ? 403 : 503;
    return applyOpsCookies(
      NextResponse.json(
        {
          ok: false,
          error:
            error instanceof Error ? error.message : "Ops authorization is currently unavailable.",
        },
        { status },
      ),
      cookieResponse,
    );
  }
}

export async function requireOpsPage(permission: OpsPermission): Promise<OpsAccess> {
  const access = await getOpsPageAccess();
  if (!access) redirect("/login");
  if (!access.permissions.includes(permission)) redirect("/forbidden");
  return access;
}

export async function getOpsPageAccess(): Promise<OpsAccess | null> {
  await connection();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !process.env.DATABASE_URL) return null;
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
      setAll: () => undefined,
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user ? getOpsAuthorizationService().getAccess(data.user.id) : null;
}

export function getOpsAuthorizationService(): OpsAuthorizationService {
  if (!process.env.DATABASE_URL) throw new Error("Ops database is not configured.");
  return createDbOpsAuthorizationService(createDb(process.env.DATABASE_URL));
}

export function applyOpsCookies(target: NextResponse, source: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export function isAuthorizedOpsRequest(
  value: AuthorizedOpsRequest | NextResponse,
): value is AuthorizedOpsRequest {
  return !(value instanceof NextResponse);
}
