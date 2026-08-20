import { describe, expect, it } from "vitest";
import { buildStaticSitemapEntries, PUBLIC_STATIC_SITEMAP_PATHS } from "./sitemap";

describe("public sitemap static entries", () => {
  it("includes only published static routes without inventing a freshness timestamp", () => {
    expect(buildStaticSitemapEntries()).toEqual([
      { url: "https://www.go2china.space/" },
      { url: "https://www.go2china.space/explore" },
      { url: "https://www.go2china.space/guides" },
      { url: "https://www.go2china.space/guides/payment" },
      { url: "https://www.go2china.space/guides/esim" },
      { url: "https://www.go2china.space/guides/network" },
    ]);
  });

  it("keeps the unlisted product home out of the sitemap", () => {
    expect(PUBLIC_STATIC_SITEMAP_PATHS).not.toContain("/homepage");
  });
});
