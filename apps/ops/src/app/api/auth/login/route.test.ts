import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAccess: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("../../../../lib/opsAccess", () => ({
  applyOpsCookies: (target: Response) => target,
  getOpsAuthorizationService: () => ({ getAccess: mocks.getAccess }),
}));

vi.mock("../../../../lib/supabaseServer", () => ({
  createOpsSupabaseRequestClient: () => ({
    auth: { signInWithPassword: mocks.signInWithPassword },
  }),
}));

import { POST } from "./route";

describe("Ops login route", () => {
  beforeEach(() => {
    mocks.getAccess.mockReset();
    mocks.signInWithPassword.mockReset();
  });

  it("does not expose a database query failure after a valid sign-in", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "a0000000-0000-4000-8000-000000000001" } },
      error: null,
    });
    mocks.getAccess.mockRejectedValue(
      new Error('Failed query: column "revoked_at" does not exist'),
    );

    const response = await POST(
      new Request("https://ops.example.test/api/auth/login", {
        body: JSON.stringify({ email: "operator@example.test", password: "password123" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "登录服务暂时不可用，请稍后重试。",
    });
  });
});
