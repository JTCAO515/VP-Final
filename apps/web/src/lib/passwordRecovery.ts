import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { readCookie } from "./requestIdentity";

export const PASSWORD_RECOVERY_PROOF_COOKIE = "vp_password_recovery";
export const PASSWORD_RECOVERY_PROOF_MAX_AGE_SECONDS = 60 * 10;

type PasswordRecoveryProof = Readonly<{ userId: string }>;

/**
 * The redirect is configuration, rather than caller input, so a reset request
 * can never turn into an open redirect.
 */
export function configuredPasswordRecoveryRedirect(request: Request): string {
  const configured = process.env.VISEPANDA_AUTH_RECOVERY_REDIRECT_URL;
  if (!configured) throw new Error("Password recovery is unavailable.");

  let target: URL;
  try {
    target = new URL(configured);
  } catch {
    throw new Error("Password recovery is unavailable.");
  }

  const requestUrl = new URL(request.url);
  const requiresHttps = process.env.NODE_ENV === "production";
  if (
    target.origin !== requestUrl.origin ||
    target.pathname !== "/auth/callback" ||
    target.search ||
    target.hash ||
    (requiresHttps && target.protocol !== "https:")
  ) {
    throw new Error("Password recovery is unavailable.");
  }

  recoveryProofSecret();
  return target.toString();
}

export function createPasswordRecoveryProof(
  userId: string,
  secret = recoveryProofSecret(),
  issuedAt = Math.floor(Date.now() / 1000),
): string {
  if (!isSafeUserId(userId)) throw new Error("Password recovery is unavailable.");
  const payload = `v1.${userId}.${issuedAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function parsePasswordRecoveryProof(
  value: string | undefined,
  secret = recoveryProofSecret(),
  now = Math.floor(Date.now() / 1000),
): PasswordRecoveryProof | null {
  if (!value) return null;
  const [version, userId, issuedAtRaw, signature, extra] = value.split(".");
  const issuedAt = Number(issuedAtRaw);
  if (
    version !== "v1" ||
    !isSafeUserId(userId) ||
    !Number.isInteger(issuedAt) ||
    !signature ||
    extra ||
    issuedAt > now + 60 ||
    now - issuedAt > PASSWORD_RECOVERY_PROOF_MAX_AGE_SECONDS
  ) {
    return null;
  }

  const expected = Buffer.from(sign(`${version}.${userId}.${issuedAt}`, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return { userId };
}

export function readPasswordRecoveryProof(request: Request): PasswordRecoveryProof | null {
  return parsePasswordRecoveryProof(
    readCookie(request.headers.get("cookie"), PASSWORD_RECOVERY_PROOF_COOKIE),
  );
}

export function issuePasswordRecoveryProof(response: NextResponse, userId: string): void {
  response.cookies.set(
    PASSWORD_RECOVERY_PROOF_COOKIE,
    createPasswordRecoveryProof(userId),
    passwordRecoveryCookieOptions(PASSWORD_RECOVERY_PROOF_MAX_AGE_SECONDS),
  );
}

export function clearPasswordRecoveryProof(response: NextResponse): void {
  response.cookies.set(PASSWORD_RECOVERY_PROOF_COOKIE, "", passwordRecoveryCookieOptions(0));
}

export function protectRecoveryResponse(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, noarchive");
  return response;
}

function recoveryProofSecret(): string {
  const secret = process.env.VISEPANDA_AUTH_RECOVERY_PROOF_SECRET;
  if (!secret || secret.length < 32) throw new Error("Password recovery is unavailable.");
  return secret;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function isSafeUserId(value: string | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9-]{1,128}$/.test(value));
}

function passwordRecoveryCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/api/auth/recover/complete",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}
