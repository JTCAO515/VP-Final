import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import type { NextResponse } from "next/server";

export const ANONYMOUS_SESSION_COOKIE = "vp_anon_session";
export const ANONYMOUS_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type RequestIdentity =
  | { kind: "anonymous"; anonId: string }
  | { kind: "authenticated"; userId: string; email?: string; anonId?: string }
  | { kind: "none" };

type AnonymousSession = { anonId: string; shouldRotate: boolean };

type SigningConfig = {
  active: { id: string; secret: string };
  previous?: { id: string; secret: string };
};

export function identityFields(identity: RequestIdentity): {
  anonId?: string | undefined;
  userId?: string | undefined;
  email?: string | undefined;
} {
  if (identity.kind === "anonymous") return { anonId: identity.anonId };
  if (identity.kind === "authenticated") {
    return {
      userId: identity.userId,
      anonId: identity.anonId,
      ...(identity.email ? { email: identity.email } : {}),
    };
  }
  return {};
}

export async function resolveRequestIdentity(
  request: Request,
  response: NextResponse,
  dependencies?: {
    getUser: () => Promise<{ data: { user: { id: string; email?: string } | null } }>;
  },
): Promise<RequestIdentity> {
  const signing = readSigningConfig();
  const anonymous = signing
    ? parseAnonymousSession(
        readCookie(request.headers.get("cookie"), ANONYMOUS_SESSION_COOKIE),
        signing,
      )
    : null;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const supabase =
    supabaseUrl && supabaseKey
      ? createServerClient(supabaseUrl, supabaseKey, {
          cookies: {
            getAll: () => parseCookies(request.headers.get("cookie")),
            setAll: (
              cookies: { name: string; value: string; options: Record<string, unknown> }[],
            ) =>
              cookies.forEach((cookie) =>
                response.cookies.set(cookie.name, cookie.value, cookie.options),
              ),
          },
        })
      : null;
  const getUser = dependencies?.getUser ?? (supabase ? () => supabase.auth.getUser() : null);
  if (getUser) {
    const { data } = await getUser();
    if (data.user) {
      if (anonymous?.shouldRotate) issueAnonymousCookie(response, signing!, anonymous.anonId);
      return {
        kind: "authenticated",
        userId: data.user.id,
        ...(data.user.email ? { email: data.user.email } : {}),
        ...(anonymous ? { anonId: anonymous.anonId } : {}),
      };
    }
  }

  if (!signing) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Anonymous session configuration is unavailable.");
    }
    return { kind: "none" };
  }
  const anonId = anonymous?.anonId ?? randomBytes(32).toString("base64url");
  if (!anonymous || anonymous.shouldRotate) issueAnonymousCookie(response, signing, anonId);
  return { kind: "anonymous", anonId };
}

export function applyIdentityCookies(target: NextResponse, source: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export function createAnonymousSessionValue(
  secret: string,
  anonId = randomBytes(32).toString("base64url"),
  issuedAt = Math.floor(Date.now() / 1000),
  keyId = "current",
) {
  const payload = `v2.${anonId}.${issuedAt}.${keyId}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function parseAnonymousSessionValue(
  value: string | undefined,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): string | null {
  return (
    parseAnonymousSession(
      value,
      {
        active: { id: "current", secret },
      },
      now,
    )?.anonId ?? null
  );
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

function readSigningConfig(): SigningConfig | null {
  const activeSecret = process.env.VISEPANDA_ANON_SESSION_SECRET;
  if (!activeSecret) return null;
  const active = {
    id: process.env.VISEPANDA_ANON_SESSION_KEY_ID ?? "current",
    secret: activeSecret,
  };
  const previousSecret = process.env.VISEPANDA_ANON_SESSION_PREVIOUS_SECRET;
  const previousId = process.env.VISEPANDA_ANON_SESSION_PREVIOUS_KEY_ID;
  return previousSecret && previousId
    ? { active, previous: { id: previousId, secret: previousSecret } }
    : { active };
}

function parseAnonymousSession(
  value: string | undefined,
  config: SigningConfig,
  now = Math.floor(Date.now() / 1000),
): AnonymousSession | null {
  if (!value) return null;
  const [version, anonId, issuedAtRaw, keyId, signature, extra] = value.split(".");
  const issuedAt = Number(issuedAtRaw);
  if (
    version !== "v2" ||
    !anonId ||
    !Number.isInteger(issuedAt) ||
    !keyId ||
    !signature ||
    extra ||
    !/^[A-Za-z0-9_-]{43}$/.test(anonId) ||
    issuedAt > now + 60 ||
    now - issuedAt > ANONYMOUS_SESSION_MAX_AGE_SECONDS
  )
    return null;

  const key =
    keyId === config.active.id
      ? config.active
      : config.previous?.id === keyId
        ? config.previous
        : null;
  if (!key) return null;
  const payload = `${version}.${anonId}.${issuedAt}.${keyId}`;
  const expected = Buffer.from(sign(payload, key.secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return { anonId, shouldRotate: key.id !== config.active.id };
}

function issueAnonymousCookie(response: NextResponse, config: SigningConfig, anonId: string) {
  response.cookies.set(
    ANONYMOUS_SESSION_COOKIE,
    createAnonymousSessionValue(config.active.secret, anonId, undefined, config.active.id),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ANONYMOUS_SESSION_MAX_AGE_SECONDS,
    },
  );
}

function parseCookies(header: string | null): { name: string; value: string }[] {
  if (!header) return [];
  return header.split(";").flatMap((part) => {
    const [name, ...rest] = part.trim().split("=");
    return name ? [{ name, value: rest.join("=") }] : [];
  });
}
