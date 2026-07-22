import Link from "next/link";

/** The suite's top-level views, in nav order. */
const NAV = [
  { href: "/", label: "Caption" },
  { href: "/curate", label: "Curate" },
  { href: "/gallery", label: "Gallery" },
  { href: "/forge", label: "Forge" },
  { href: "/proof", label: "Proof" },
  { href: "/docs", label: "Docs" },
] as const;

/** True when `active` (the current route) should highlight the tab `href`. */
function isActive(href: string, active: string): boolean {
  // "/" must match exactly so it isn't highlighted on every route; section
  // tabs (e.g. "/docs") match their whole subtree ("/docs/captioning/...").
  if (href === "/") return active === "/";
  return active === href || active.startsWith(`${href}/`);
}

/**
 * Shared top-nav used by every page's header. `active` is the current route's
 * path (e.g. "/proof" or "/docs/captioning/target-category"); the matching tab
 * renders as the highlighted pill. Centralizing it here keeps the pages from
 * drifting when a tab is added or restyled.
 */
export function Nav({ active }: { active: string }) {
  return (
    <nav className="flex items-center gap-1">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={
            isActive(n.href, active)
              ? "rounded-lg border border-border bg-surface-hover px-3 py-1.5 text-sm text-foreground"
              : "rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          }
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
