import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { sitemapPaths, sitemapUrls } from "@/lib/sitemap";

const APP = join(__dirname, "..", "app");

/** The page file a site path is served from (route groups like `(caption)` don't appear in the URL). */
function pageFile(path: string): string | null {
  const segs = path.replace(/^\/|\/$/g, "");
  const candidates = segs === "" ? ["(caption)/page.tsx", "page.tsx"] : [`${segs}/page.tsx`, `${segs}/page.mdx`];
  return candidates.map((c) => join(APP, c)).find((f) => existsSync(f)) ?? null;
}

describe("sitemapPaths", () => {
  it("lists the tool pages and Studio's own docs, once each, with the trailing slash", () => {
    const paths = sitemapPaths();
    expect(paths).toContain("/");
    expect(paths).toContain("/darkroom/");
    expect(paths).toContain("/docs/captioning/prose-enrichment/");
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((p) => p.startsWith("/") && p.endsWith("/"))).toBe(true);
    expect(paths.some((p) => p.includes("dragonhound.dev"))).toBe(false);
  });

  it.each(sitemapPaths())("%s is a real page", (path) => {
    expect(pageFile(path), path).not.toBeNull();
  });
});

describe("sitemapUrls", () => {
  it("is absolute under the origin, and empty without one", () => {
    expect(sitemapUrls("https://studio.dragonhound.dev")[0]).toBe("https://studio.dragonhound.dev/gallery/");
    expect(sitemapUrls(null)).toEqual([]);
  });
});
