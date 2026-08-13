import { deriveSeoPageMatrix, type Poi, type SeoPageCandidate } from "@visepanda/domain";
import type { MetadataRoute } from "next";

export const PUBLIC_SITE_URL = "https://www.go2china.space";

/**
 * Public SEO URLs have one authority: the current evidence-gated domain matrix. The matrix itself
 * rejects duplicate canonical paths, and this projection keeps the route list limited to those
 * candidates rather than legacy POI records.
 */
export function buildEvidenceGatedSitemapEntries(
  pois: readonly Poi[],
  input: { baseUrl?: string; now?: Date } = {},
): MetadataRoute.Sitemap {
  const pages = deriveSeoPageMatrix(pois, input.now).pages;
  assertUniqueCanonicalPaths(pages);
  const baseUrl = normalizeBaseUrl(input.baseUrl ?? PUBLIC_SITE_URL);
  return pages.map((page) => ({
    url: `${baseUrl}${page.canonicalPath}`,
    lastModified: new Date(page.lastVerifiedAt),
    changeFrequency: "weekly",
  }));
}

export function assertUniqueCanonicalPaths(pages: readonly SeoPageCandidate[]): void {
  const paths = pages.map((page) => page.canonicalPath);
  if (new Set(paths).size !== paths.length) {
    throw new Error("Evidence-gated SEO sitemap contains duplicate canonical paths.");
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, "");
}
