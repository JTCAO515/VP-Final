import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("./supabaseServer", () => ({
  createSupabaseServerClient: (_request: Request, response: { cookies: { set: Function } }) => {
    response.cookies.set("sb-access-token", "server-cookie", { httpOnly: true });
    return { auth: mocks };
  },
}));

import { POST as login } from "../app/api/auth/login/route";
import { POST as logout } from "../app/api/auth/logout/route";
import { GET as recoveryCallback } from "../app/auth/callback/route";
import { POST as completeRecovery } from "../app/api/auth/recover/complete/route";
import { POST as requestRecovery } from "../app/api/auth/recover/route";
import { POST as register } from "../app/api/auth/register/route";
import { createPasswordRecoveryProof } from "./passwordRecovery";

const proofSecret = "password-recovery-test-secret-with-at-least-32-characters";
const originalRecoveryRedirect = process.env.VISEPANDA_AUTH_RECOVERY_REDIRECT_URL;
const originalRecoverySecret = process.env.VISEPANDA_AUTH_RECOVERY_PROOF_SECRET;

describe("auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VISEPANDA_AUTH_RECOVERY_REDIRECT_URL = "https://example.test/auth/callback";
    process.env.VISEPANDA_AUTH_RECOVERY_PROOF_SECRET = proofSecret;
  });

  afterAll(() => {
    if (originalRecoveryRedirect === undefined)
      delete process.env.VISEPANDA_AUTH_RECOVERY_REDIRECT_URL;
    else process.env.VISEPANDA_AUTH_RECOVERY_REDIRECT_URL = originalRecoveryRedirect;
    if (originalRecoverySecret === undefined)
      delete process.env.VISEPANDA_AUTH_RECOVERY_PROOF_SECRET;
    else process.env.VISEPANDA_AUTH_RECOVERY_PROOF_SECRET = originalRecoverySecret;
  });

  it("logs in through the server adapter and emits only display-safe user data", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "private-user-id", email: "traveler@example.com" } },
      error: null,
    });
    const response = await login(
      new Request("https://example.test/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "traveler@example.com", password: "correct-password" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      user: { email: "traveler@example.com" },
    });
    expect(response.headers.get("set-cookie")).toContain("sb-access-token=server-cookie");
  });

  it("returns an honest generic error for rejected credentials", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new Error("provider detail"),
    });
    const response = await login(
      new Request("https://example.test/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "traveler@example.com", password: "wrong-password" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: "Email or password is incorrect." });
  });

  it("registers through Supabase and reports when email confirmation is required", async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        user: { id: "private-user-id", email: "new@example.com" },
        session: null,
      },
      error: null,
    });
    const response = await register(
      new Request("https://example.test/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "new@example.com", password: "correct-password" }),
      }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      ok: true,
      confirmationRequired: true,
      user: { email: "new@example.com" },
    });
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "correct-password",
    });
  });

  it("keeps provider registration details out of public errors", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error("private provider response"),
    });
    const response = await register(
      new Request("https://example.test/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "new@example.com", password: "correct-password" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toContain("private provider response");
  });

  it("logs out through the server adapter and forwards cookie clearing", async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    const response = await logout(
      new Request("https://example.test/api/auth/logout", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(response.headers.get("set-cookie")).toContain("sb-access-token=server-cookie");
  });

  it("hands every valid recovery request to Supabase and returns the same acknowledgement", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const response = await requestRecovery(
      new Request("https://example.test/api/auth/recover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "traveler@example.com" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("traveler@example.com", {
      redirectTo: "https://example.test/auth/callback",
    });
  });

  it("never exposes a provider recovery error or reports a sent email when recovery is unavailable", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: new Error("account missing"),
    });
    const response = await requestRecovery(
      new Request("https://example.test/api/auth/recover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "traveler@example.com" }),
      }),
    );

    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("account missing");
  });

  it("fails honestly before provider handoff when the recovery proof configuration is absent", async () => {
    delete process.env.VISEPANDA_AUTH_RECOVERY_PROOF_SECRET;
    const response = await requestRecovery(
      new Request("https://example.test/api/auth/recover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "traveler@example.com" }),
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      error: "Password recovery is temporarily unavailable.",
    });
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("exchanges the recovery code server-side and removes it from the destination URL", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "private-user-id" } }, error: null });
    const response = await recoveryCallback(
      new Request("https://example.test/auth/callback?code=short-lived-provider-code"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.test/account?recovery=1");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("set-cookie")).toContain("vp_password_recovery=");
    expect(JSON.stringify(await response.text())).not.toContain("short-lived-provider-code");
  });

  it("requires a matching live session and short-lived proof before updating a password", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "private-user-id" } }, error: null });
    mocks.updateUser.mockResolvedValue({ data: { user: { id: "private-user-id" } }, error: null });
    const proof = createPasswordRecoveryProof("private-user-id", proofSecret);
    const response = await completeRecovery(
      new Request("https://example.test/api/auth/recover/complete", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `vp_password_recovery=${proof}` },
        body: JSON.stringify({ password: "new-safe-password" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-safe-password" });
    expect(response.headers.get("set-cookie")).toContain("vp_password_recovery=;");
  });

  it("rejects a recovery proof that does not match the verified session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "different-user-id" } }, error: null });
    const proof = createPasswordRecoveryProof("private-user-id", proofSecret);
    const response = await completeRecovery(
      new Request("https://example.test/api/auth/recover/complete", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `vp_password_recovery=${proof}` },
        body: JSON.stringify({ password: "new-safe-password" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
