import type { MetadataRoute } from "next";

import { DEMO_SITE_URL, STATIC_DEMO } from "@/lib/staticDemo";

export const dynamic = "force-static";

/** Crawlable; the static demo also points at its sitemap (#41). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    ...(STATIC_DEMO ? { sitemap: new URL("/sitemap.xml", DEMO_SITE_URL).href } : {}),
  };
}
