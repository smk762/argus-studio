/**
 * Sidebar manifest for the /docs handbook. Pages register here once; the
 * sidebar and (later) search read from this list. Grows as concept and guide
 * pages are authored (epic: interactive-docs).
 */
export interface DocsNavItem {
  href: string;
  label: string;
}

export interface DocsNavSection {
  title: string;
  items: DocsNavItem[];
}

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
];

/** A page in reading order, carrying the section it belongs to (for breadcrumbs). */
export interface DocsNavPage extends DocsNavItem {
  section: string;
}

/**
 * The manifest flattened into linear reading order — the single source both
 * prev/next paging and the breadcrumb read, so page order lives in one place.
 */
export const DOCS_PAGES: DocsNavPage[] = DOCS_NAV.flatMap((section) =>
  section.items.map((item) => ({ ...item, section: section.title })),
);

/** Prev/next/current for `pathname`, or nulls when it is not a registered page. */
export function docsPager(pathname: string): {
  current: DocsNavPage | null;
  prev: DocsNavPage | null;
  next: DocsNavPage | null;
} {
  const i = DOCS_PAGES.findIndex((p) => p.href === pathname);
  if (i === -1) return { current: null, prev: null, next: null };
  return {
    current: DOCS_PAGES[i],
    prev: i > 0 ? DOCS_PAGES[i - 1] : null,
    next: i < DOCS_PAGES.length - 1 ? DOCS_PAGES[i + 1] : null,
  };
}
