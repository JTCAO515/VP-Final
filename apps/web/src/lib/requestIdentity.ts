import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import type { NextResponse } from "next/server";

export const ANONYMOUS_SESSION_COOKIE = "vp_anon_session";

export type RequestIdentity =
  | { kind: "anonymous"; anonId: string }
  | { kind: "authenticated"; userId: string; email?: string }
  | { kind: "none" };

export function identityFields(identity: RequestIdentity): {
  anonId?: string;
  userId?: string;
  email?: string;
} {
  if (identity.kind === "anonymous") return { anonId: identity.anonId };
  if (identity.kind === "authenticated") {
    return identity.email ? { userId: identity.userId, email: identity.email } : { userId: identity.userId };
  }
  return {};
}

export async function resolveRequestIdentity(request: Request, response: NextResponse): Promise<RequestIdentity> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => parseCookies(request.headers.get("cookie")),
        setAll: (cookies: { name: string; value: string; options: Record<string, unknown> }[]) =>
          cookies.forEach((cookie) => response.cookies.set(cookie.name, cookie.value, cookie.options)),
      },
    });
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      return data.user.email
        ? { kind: "authenticated", userId: data.user.id, email: data.user.email }
        : { kind: "authenticated", userId: data.user.id };
    }
  }

  const secret = process.env.VISEPANDA_ANON_SESSION_SECRET;
  if (!secret) return { kind: "none" };
  const existing = parseAnonymousSessionValue(readCookie(request.headers.get("cookie"), ANONYMOUS_SESSION_COOKIE), secret);
  const anonId = existing ?? randomBytes(32).toString("base64url");
  if (!existing) {
    response.cookies.set(ANONYMOUS_SESSION_COOKIE, createAnonymousSessionValue(secret, anonId), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return { kind: "anonymous", anonId };
}

export function applyIdentityCookies(target: NextResponse, source: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export function createAnonymousSessionValue(secret: string, anonId = randomBytes(32).toString("base64url")) {
  const payload = `v1.${anonId}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function parseAnonymousSessionValue(value: string | undefined, secret: string): string | null {
  if (!value) return null;
  const [version, anonId, signature, extra] = value.split(".");
  if (version !== "v1" || !anonId || !signature || extra || !/^[A-Za-z0-9_-]{43}$/.test(anonId)) return null;

  const expected = Buffer.from(sign(`${version}.${anonId}`, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return anonId;
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function parseCookies(header: string | null): { name: string; value: string }[] {
  if (!header) return [];
  return header.split(";").flatMap((part) => {
    const [name, ...rest] = part.trim().split("=");
    return name ? [{ name, value: rest.join("=") }] : [];
  });
}
