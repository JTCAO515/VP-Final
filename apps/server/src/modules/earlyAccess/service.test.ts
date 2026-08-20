import { describe, expect, it } from "vitest";
import {
  createInMemoryEarlyAccessSignupService,
  normalizeEarlyAccessUserAgent,
} from "./service.js";

describe("Early Access service", () => {
  it("keeps one canonical signup and reports a repeat honestly", async () => {
    const service = createInMemoryEarlyAccessSignupService();
    const input = { email: "traveler@example.com", locale: "en", source: "landing" as const };
    const metadata = { ipHash: "a".repeat(64) };

    await expect(service.submit(input, metadata)).resolves.toEqual({ status: "subscribed" });
    await expect(service.submit(input, metadata)).resolves.toEqual({
      status: "already_subscribed",
    });
  });

  it("bounds an optional user agent without retaining an empty value", () => {
    expect(normalizeEarlyAccessUserAgent(null)).toBeUndefined();
    expect(normalizeEarlyAccessUserAgent("   ")).toBeUndefined();
    expect(normalizeEarlyAccessUserAgent("a".repeat(700))).toHaveLength(512);
  });
});
