import type { MetadataRoute } from "next";
import { getServerCaller } from "./api/_server";
import { GUIDES } from "./guides/data";
import { buildEvidenceGatedSitemapEntries, PUBLIC_SITE_URL } from "./seo-index-model";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pois = await getServerCaller().knowledge.listPois();
  return [
    url("/"),
    url("/explore"),
    ...GUIDES.map((guide) => url(`/guides/${guide.slug}`)),
    ...buildEvidenceGatedSitemapEntries(pois),
  ];
}

function url(path: string): MetadataRoute.Sitemap[number] {
  return {
    url: `${PUBLIC_SITE_URL}${path}`,
    lastModified: new Date("2026-07-09"),
    changeFrequency: "weekly",
  };
}
