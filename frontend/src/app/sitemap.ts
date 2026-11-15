import type { MetadataRoute } from "next";

import { sitemapUrls } from "@/lib/sitemap";
import { DEMO_SITE_URL, STATIC_DEMO } from "@/lib/staticDemo";

// Built once: the static export needs it, and the page list is fixed at build time.
export const dynamic = "force-static";

/**
 * The static demo's sitemap (#41). Only the static demo knows its public
 * origin; a self-hosted server build can't, and a sitemap needs absolute
 * URLs, so there it is empty.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapUrls(STATIC_DEMO ? DEMO_SITE_URL : null).map((url) => ({ url }));
}
