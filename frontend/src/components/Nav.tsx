import Link from "next/link";

/**
 * The suite's top-level views, in pipeline order (#67) — acquire, curate,
 * caption, configure, evaluate — not in the order the pages happened to be
 * built. `stage` numbers the five that are pipeline steps; /docs is a reference
 * surface and sits outside the sequence.
 *
 * "/" stays the caption tool even though it is stage 3: it is argus-lens, the
 * suite's front door, and moving it would break every existing link.
 */
const NAV = [
  { href: "/gallery", label: "Gallery", stage: 1 },
  { href: "/curate", label: "Curate", stage: 2 },
  { href: "/", label: "Caption", stage: 3 },
  { href: "/forge", label: "Forge", stage: 4 },
  { href: "/proof", label: "Proof", stage: 5 },
  { href: "/docs", label: "Docs", stage: null },
] as const;

const STAGES = NAV.filter((n) => n.stage !== null).length;

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
    // Six tabs no longer fit a narrow viewport, and this sits in a
    // justify-between header beside the title block and the version badge:
    // without wrapping, the labels overflow the sticky header.
    <nav className="flex flex-wrap items-center justify-end gap-1">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          // The digit is decoration for a sighted reader scanning the row; a
          // screen reader gets the position spelled out instead of a bare "1".
          aria-label={n.stage ? `${n.label} — pipeline stage ${n.stage} of ${STAGES}` : undefined}
          className={
            isActive(n.href, active)
              ? "rounded-lg border border-border bg-surface-hover px-3 py-1.5 text-sm text-foreground"
              : "rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          }
        >
          {n.stage != null && (
            <span aria-hidden className="mr-1.5 font-mono text-[10px] text-muted/70">
              {n.stage}
            </span>
          )}
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
