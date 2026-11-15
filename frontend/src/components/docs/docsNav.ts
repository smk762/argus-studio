/**
 * Sidebar manifest for the /docs handbook. Pages register here once; the
 * sidebar and (later) search read from this list. Grows as concept and guide
 * pages are authored (epic: interactive-docs).
 */
import { handbookUrl } from "@/lib/handbook";

export interface DocsNavItem {
  /** A /docs route, or an absolute URL for a page that lives off-site. */
  href: string;
  label: string;
}

export interface DocsNavSection {
  title: string;
  items: DocsNavItem[];
}

/** True for an item that links off-site (the suite docs in argus-handbook). */
export const isExternalItem = (item: DocsNavItem): boolean => /^https?:\/\//.test(item.href);

export const DOCS_NAV: DocsNavSection[] = [
  {
    title: "Getting started",
    items: [{ href: "/docs", label: "Overview" }],
  },
  {
    // Ordered as the Caption tool presents the controls, so the sidebar reads
    // in the order a user meets these decisions.
    title: "Captioning",
    items: [
      { href: "/docs/captioning/target-style", label: "Target style" },
      { href: "/docs/captioning/target-backend", label: "Target backend" },
      { href: "/docs/captioning/target-category", label: "Target category" },
      { href: "/docs/captioning/prose-enrichment", label: "Prose enrichment" },
    ],
  },
  {
    // The setup guides and each package's docs live in argus-handbook
    // (docs.dragonhound.dev). Links only: they are not in the pager.
    title: "Suite docs",
    items: [
      { href: handbookUrl("setup/"), label: "Setup and services" },
      { href: handbookUrl("packages/"), label: "Packages" },
    ],
  },
];

/** A page in reading order, carrying the section it belongs to (for breadcrumbs). */
export interface DocsNavPage extends DocsNavItem {
  section: string;
}

/**
 * The manifest's own pages flattened into linear reading order — the single
 * source both prev/next paging and the breadcrumb read, so page order lives in
 * one place. Off-site items are left out: paging never leaves Studio.
 */
export const DOCS_PAGES: DocsNavPage[] = DOCS_NAV.flatMap((section) =>
  section.items.filter((item) => !isExternalItem(item)).map((item) => ({ ...item, section: section.title })),
);

/** Prev/next/current for `pathname`, or nulls when it is not a registered page. */
export function docsPager(pathname: string): {
  current: DocsNavPage | null;
  prev: DocsNavPage | null;
  next: DocsNavPage | null;
} {
  // The static export serves every route with a trailing slash.
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  const i = DOCS_PAGES.findIndex((p) => p.href === path);
  if (i === -1) return { current: null, prev: null, next: null };
  return {
    current: DOCS_PAGES[i],
    prev: i > 0 ? DOCS_PAGES[i - 1] : null,
    next: i < DOCS_PAGES.length - 1 ? DOCS_PAGES[i + 1] : null,
  };
}
