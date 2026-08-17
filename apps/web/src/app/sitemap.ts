import type { MetadataRoute } from "next";
import { getServerCaller } from "./api/_server";
import { GUIDES } from "./guides/data";
import { buildEvidenceGatedSitemapEntries, PUBLIC_SITE_URL } from "./seo-index-model";

export const dynamic = "force-dynamic";

export const PUBLIC_STATIC_SITEMAP_PATHS = [
  "/",
  "/explore",
  "/guides",
  ...GUIDES.map((guide) => `/guides/${guide.slug}`),
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pois = await getServerCaller().knowledge.listPois();
  return [...buildStaticSitemapEntries(), ...buildEvidenceGatedSitemapEntries(pois)];
}

export function buildStaticSitemapEntries(): MetadataRoute.Sitemap {
  return PUBLIC_STATIC_SITEMAP_PATHS.map((path) => ({
    url: `${PUBLIC_SITE_URL}${path}`,
  }));
}
