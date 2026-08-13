import { describe, expect, it } from "vitest";

import {
  getToolContentPackItem,
  TOOLS_CONTENT_PACK,
  ToolContentPackItemSchema,
  ToolsContentPackSchema,
} from "./index.js";

describe("Tools content pack", () => {
  it("provides exactly one local-only preparation item for every required tool", () => {
    expect(TOOLS_CONTENT_PACK.version).toBe(1);
    expect(TOOLS_CONTENT_PACK.items).toHaveLength(8);
    expect(new Set(TOOLS_CONTENT_PACK.items.map((item) => item.id)).size).toBe(8);
    for (const item of TOOLS_CONTENT_PACK.items) {
      expect(item.availability).toBe("local_content_only");
      expect(item.steps.length).toBeGreaterThanOrEqual(2);
      expect(item.actionLabel).not.toBe("");
    }
  });

  it("uses local action identifiers instead of live partner, booking, or API URLs", () => {
    expect(JSON.stringify(TOOLS_CONTENT_PACK)).not.toMatch(/https?:\/\//i);
    expect(JSON.stringify(TOOLS_CONTENT_PACK)).not.toMatch(/book now|buy now|available now/i);
    expect(getToolContentPackItem("emergency_boundary").actionId).toBe("open_emergency_guidance");
  });

  it("rejects duplicate item ids and non-local availability", () => {
    const duplicate = { ...TOOLS_CONTENT_PACK, items: [...TOOLS_CONTENT_PACK.items] };
    duplicate.items[1] = duplicate.items[0]!;
    expect(ToolsContentPackSchema.safeParse(duplicate).success).toBe(false);
    expect(
      ToolContentPackItemSchema.safeParse({
        ...TOOLS_CONTENT_PACK.items[0],
        availability: "live_api",
      }).success,
    ).toBe(false);
  });
});
