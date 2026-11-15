/**
 * The pages a sitemap lists (#41): every pipeline route and every Studio docs
 * page, from the lists the nav already uses, so a new page can't be left out.
 * Paths carry the trailing slash the static export serves them at.
 */

import { DOCS_PAGES } from "@/components/docs/docsNav";
import { PIPELINE } from "@/lib/pipeline";

const withSlash = (path: string) => (path.endsWith("/") ? path : `${path}/`);

/** Site-relative paths, without duplicates, in nav order. */
export function sitemapPaths(): string[] {
  const paths = [...PIPELINE.map((s) => s.href), ...DOCS_PAGES.filter((p) => p.href.startsWith("/")).map((p) => p.href)];
  return [...new Set(paths.map(withSlash))];
}

/** Absolute URLs for the sitemap under `origin`, or none without one. */
export function sitemapUrls(origin: string | null): string[] {
  return origin ? sitemapPaths().map((path) => new URL(path, origin).href) : [];
}
