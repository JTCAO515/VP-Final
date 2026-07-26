import { describe, expect, it } from "vitest";
import { costWindow, privateIdentityReference, requireCostRead } from "./service.js";

describe("Ops cost summary policy", () => {
  it("allows only the explicit cost.read permission", () => {
    expect(() =>
      requireCostRead({ userId: crypto.randomUUID(), role: "admin", permissions: ["cost.read"] }),
    ).not.toThrow();
    expect(() =>
      requireCostRead({
        userId: crypto.randomUUID(),
        role: "operator",
        permissions: ["task.read"],
      }),
    ).toThrow("Forbidden Ops permission.");
    expect(() =>
      requireCostRead({
        userId: crypto.randomUUID(),
        role: "operator",
        permissions: ["cost.read"],
      }),
    ).toThrow("Forbidden Ops permission.");
  });

  it("uses a bounded inclusive UTC window", () => {
    expect(costWindow(new Date("2026-07-26T18:00:00.000Z"), 14)).toEqual({
      fromDay: "2026-07-13",
      throughDay: "2026-07-26",
    });
    expect(() => costWindow(new Date("2026-07-26T00:00:00.000Z"), 0)).toThrow();
    expect(() => costWindow(new Date("2026-07-26T00:00:00.000Z"), 91)).toThrow();
  });

  it("returns a stable non-reversible reference instead of a raw identity", () => {
    const rawIdentity = "8e694318-9627-4473-bc3c-31d35d4c8f60";
    const first = privateIdentityReference("authenticated", rawIdentity);
    expect(first).toMatch(/^user-[a-f0-9]{12}$/);
    expect(first).not.toContain(rawIdentity);
    expect(privateIdentityReference("authenticated", rawIdentity)).toBe(first);
    expect(privateIdentityReference("anonymous", rawIdentity)).not.toBe(first);
  });
});
