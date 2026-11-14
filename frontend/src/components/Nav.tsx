"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PIPELINE, STAGE_COUNT } from "@/lib/pipeline";

/** True when `active` (the current route) should highlight the tab `href`. */
function isActive(href: string, active: string): boolean {
  // "/" must match exactly so it isn't highlighted on every route; section
  // tabs (e.g. "/docs") match their whole subtree ("/docs/captioning/...").
  if (href === "/") return active === "/";
  return active === href || active.startsWith(`${href}/`);
}

// Full class strings so Tailwind's JIT keeps them. A fade marks each edge that
// has more tabs beyond it; an edge with nothing past it stays sharp.
const FADE = {
  none: "",
  left: "[mask-image:linear-gradient(to_right,transparent,black_2rem)]",
  right: "[mask-image:linear-gradient(to_left,transparent,black_2rem)]",
  both: "[mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]",
} as const;

/**
 * Shared top-nav used by every page's header, ordered by the pipeline (#67).
 * `active` is the current route's path (e.g. "/proof" or "/docs/captioning/
 * target-category"); the matching tab renders as the highlighted pill. The tab
 * list, order and stage numbers all come from the one PIPELINE definition, so
 * pages can't drift when a stage is added or restyled.
 *
 * The tabs are one row that never wraps. Where they don't fit (a phone), the row
 * scrolls sideways with snap points, fades the edge that has more tabs past it,
 * and starts scrolled to the active tab. Keyboard focus scrolls a tab into view
 * natively, so Tab order and focus rings are unchanged.
 */
export function Nav({ active }: { active: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState<keyof typeof FADE>("none");

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setFade(left && right ? "both" : left ? "left" : right ? "right" : "none");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Bring the active tab into view without moving the page itself
    // (scrollIntoView would also scroll the window on a long page).
    const current = el.querySelector<HTMLElement>("[aria-current=page]");
    if (current && el.scrollWidth > el.clientWidth) {
      const tab = current.getBoundingClientRect();
      const row = el.getBoundingClientRect();
      el.scrollLeft += tab.left - row.left - (row.width - tab.width) / 2;
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <nav aria-label="Studio tools" className="min-w-0">
      {/* py-1 leaves room for the focus ring: an overflow container clips both axes. */}
      <div
        ref={ref}
        onScroll={measure}
        className={`-my-1 flex snap-x snap-proximity items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${FADE[fade]}`}
      >
        {PIPELINE.map((n) => {
          const current = isActive(n.href, active);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={current ? "page" : undefined}
              // The digit is decoration for a sighted reader scanning the row; a
              // screen reader gets the position spelled out instead of a bare "1".
              aria-label={n.stage != null ? `${n.label} — pipeline stage ${n.stage} of ${STAGE_COUNT}` : undefined}
              className={`shrink-0 snap-start whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
                current
                  ? "border border-border bg-surface-hover text-foreground"
                  : "text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              {n.stage != null && (
                <span aria-hidden className="mr-1.5 font-mono text-[10px] text-muted/70">
                  {n.stage}
                </span>
              )}
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
