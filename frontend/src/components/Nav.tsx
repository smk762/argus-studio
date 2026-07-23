import Link from "next/link";
import { PIPELINE, STAGE_COUNT } from "@/lib/pipeline";

/** True when `active` (the current route) should highlight the tab `href`. */
function isActive(href: string, active: string): boolean {
  // "/" must match exactly so it isn't highlighted on every route; section
  // tabs (e.g. "/docs") match their whole subtree ("/docs/captioning/...").
  if (href === "/") return active === "/";
  return active === href || active.startsWith(`${href}/`);
}

/**
 * Shared top-nav used by every page's header, ordered by the pipeline (#67).
 * `active` is the current route's path (e.g. "/proof" or "/docs/captioning/
 * target-category"); the matching tab renders as the highlighted pill. The tab
 * list, order and stage numbers all come from the one PIPELINE definition, so
 * pages can't drift when a stage is added or restyled.
 */
export function Nav({ active }: { active: string }) {
  return (
    // Six tabs no longer fit a narrow viewport, and this sits in a
    // justify-between header beside the title block and the version badge:
    // without wrapping, the labels overflow the sticky header.
    <nav className="flex flex-wrap items-center justify-end gap-1">
      {PIPELINE.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          // The digit is decoration for a sighted reader scanning the row; a
          // screen reader gets the position spelled out instead of a bare "1".
          aria-label={n.stage != null ? `${n.label} — pipeline stage ${n.stage} of ${STAGE_COUNT}` : undefined}
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
