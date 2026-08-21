import { expect, it } from "vitest";
import nextConfig from "../next.config";

it("keeps the V3 shell framed, capability-minimized, and implementation-header free", async () => {
  expect(nextConfig.poweredByHeader).toBe(false);
  const rules = await nextConfig.headers?.();
  const headers = rules?.[0]?.headers ?? [];
  const csp = headers.find((header) => header.key === "Content-Security-Policy")?.value;
  expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  expect(csp).not.toContain("'unsafe-eval'");
  expect(headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
  expect(headers).toContainEqual({
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  });
});
