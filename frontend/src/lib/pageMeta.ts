import type { Metadata } from "next";

import { DEMO_SITE_URL, STATIC_DEMO } from "@/lib/staticDemo";

/**
 * One route's metadata: its own <title> (the root layout's template appends
 * "· Argus Studio demo"), description, and, in the static demo, its own canonical
 * and Open Graph URL and title (S6: every page used to claim "/" as canonical).
 * `path` is the route as served, with the trailing slash the export uses.
 */
export function pageMetadata({
  title,
  path,
  description,
  section = false,
}: {
  title: string;
  path: string;
  description?: string;
  /** A layout with pages under it (/docs): it re-states the template, which a plain string title would drop for its children. */
  section?: boolean;
}): Metadata {
  const suffix = STATIC_DEMO ? "Argus Studio demo" : "Argus Studio";
  const t = section ? { default: title, template: `%s · ${suffix}` } : title;
  if (!STATIC_DEMO) return { title: t, ...(description ? { description } : {}) };
  const full = `${title} · ${suffix}`;
  return {
    title: t,
    ...(description ? { description } : {}),
    alternates: { canonical: path },
    openGraph: { title: full, url: new URL(path, DEMO_SITE_URL).href, ...(description ? { description } : {}) },
    twitter: { title: full, ...(description ? { description } : {}) },
  };
}
