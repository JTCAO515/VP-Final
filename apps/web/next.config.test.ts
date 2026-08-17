import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("Web security-header baseline", () => {
  it("protects every route without exposing the Next.js implementation header", async () => {
    const rules = await nextConfig.headers?.();
    const headers = new Map(rules?.[0]?.headers.map((header) => [header.key, header.value]));

    expect(rules).toEqual([
      expect.objectContaining({
        source: "/(.*)",
      }),
    ]);
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(headers.get("Content-Security-Policy")).toContain("object-src 'none'");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Content-Security-Policy")).not.toContain("unsafe-eval");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Permissions-Policy")).toContain("microphone=()");
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });
});
