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
