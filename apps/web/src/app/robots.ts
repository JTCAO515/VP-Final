import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "./seo-index-model";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account",
        "/auth/",
        "/arrival-pack",
        "/api/",
        "/copilot",
        "/human-help",
        "/outbound",
        "/readiness",
        "/share/",
        "/visepanda",
      ],
    },
    sitemap: `${PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
