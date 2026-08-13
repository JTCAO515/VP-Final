import { describe, expect, it } from "vitest";
import { applySeoEditorialOverride, SeoEditorialOverrideSchema } from "./editorial.js";

const base = { title: "Yu Garden transport guide", summary: "Reviewed transport information." };

describe("SEO editorial overrides", () => {
  it("replaces only supplied presentation fields and leaves the candidate unchanged otherwise", () => {
    const override = SeoEditorialOverrideSchema.parse({
      poiId: "8bdf3a4e-541b-4e01-a1f8-fec4546b7061",
      intent: "transport",
      title: "Getting to Yu Garden",
      summary: null,
      emphasis: "Plan your route before leaving.",
      updatedAt: "2026-08-13T00:00:00.000Z",
    });

    expect(applySeoEditorialOverride(base, override)).toEqual({
      title: "Getting to Yu Garden",
      summary: base.summary,
      emphasis: "Plan your route before leaving.",
    });
  });

  it("rejects an empty override and returns generated content after deletion", () => {
    expect(() =>
      SeoEditorialOverrideSchema.parse({
        poiId: "8bdf3a4e-541b-4e01-a1f8-fec4546b7061",
        intent: "transport",
        title: null,
        summary: null,
        emphasis: null,
        updatedAt: "2026-08-13T00:00:00.000Z",
      }),
    ).toThrow("An editorial override");

    expect(applySeoEditorialOverride(base, null)).toEqual({ ...base, emphasis: null });
  });
});
