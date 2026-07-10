import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("./supabaseServer", () => ({
  createSupabaseServerClient: (_request: Request, response: { cookies: { set: Function } }) => {
    response.cookies.set("sb-access-token", "server-cookie", { httpOnly: true });
    return { auth: mocks };
  },
}));

import { POST as login } from "../app/api/auth/login/route";
import { POST as logout } from "../app/api/auth/logout/route";

describe("auth routes", () => {
  beforeEach(() => vi.clearAllMocks());

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
});
