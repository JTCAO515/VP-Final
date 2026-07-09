import type { MetadataRoute } from "next";
import { GUIDES } from "./guides/data";
import { poiEntries } from "./poiSeo";

const baseUrl = "https://visepanda.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    url("/"),
    url("/explore"),
    ...GUIDES.map((guide) => url(`/guides/${guide.slug}`)),
    ...poiEntries().map((entry) => url(`/${entry.citySlug}/${entry.poiSlug}`)),
  ];
}

function url(path: string): MetadataRoute.Sitemap[number] {
  return {
    url: `${baseUrl}${path}`,
    lastModified: new Date("2026-07-09"),
    changeFrequency: "weekly",
  };
}
