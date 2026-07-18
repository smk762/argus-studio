"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * "On this page" rail, built at runtime from the article's `h2`/`h3` ids (which
 * `mdx-components` slugs). Reading the DOM keeps the TOC in lockstep with the
 * MDX content without the page having to declare its own outline. Re-scans on
 * route change and scroll-spies the heading nearest the top.
 */
export function DocsToc() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  // Collect headings after the new route's content has mounted. Reading the
  // rendered DOM is inherently a post-commit step, so setting state here is the
  // intended pattern rather than the anti-pattern the rule usually guards.
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>("main article :is(h2, h3)[id]");
    const next = Array.from(nodes).map<Heading>((el) => ({
      id: el.id,
      text: el.textContent ?? "",
      level: el.tagName === "H3" ? 3 : 2,
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM read must run after render
    setHeadings(next);
    // Drop the previous route's active heading: sibling pages share slug ids
    // (e.g. every concept page has a "Try it" -> #try-it), so without this a
    // stale highlight carries over on client navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on route change
    setActiveId("");
  }, [pathname]);

  // Scroll-spy: highlight the topmost heading currently inside the top band.
  useEffect(() => {
    if (headings.length === 0) return;
    // Band top inset, matched to the sticky header so an anchored heading counts.
    const TOP_INSET = 80;
    // Which headings are currently in the band; the first in document order wins.
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const topmost = headings.find((h) => visible.has(h.id));
        setActiveId((prev) => {
          // A heading is in the band -> it becomes current (no-op if unchanged).
          if (topmost) return topmost.id;
          // Nothing in the band: keep the current heading while reading down a
          // long section, and only drop the highlight once scrolled back above
          // the first heading, where nothing is "current" over the intro.
          const first = document.getElementById(headings[0].id);
          if (first && first.getBoundingClientRect().top > TOP_INSET) return "";
          return prev;
        });
      },
      // Trigger as a heading crosses the upper quarter of the viewport.
      { rootMargin: `-${TOP_INSET}px 0px -70% 0px`, threshold: 0 },
    );
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="On this page" className="space-y-2 text-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">On this page</p>
      <ul className="space-y-1.5 border-l border-border">
        {headings.map((h) => {
          const active = h.id === activeId;
          return (
            <li key={h.id} className={h.level === 3 ? "ml-3" : ""}>
              <a
                href={`#${h.id}`}
                aria-current={active ? "location" : undefined}
                className={
                  active
                    ? "-ml-px block border-l-2 border-accent-purple pl-3 text-foreground"
                    : "-ml-px block border-l-2 border-transparent pl-3 text-muted transition-colors hover:text-foreground"
                }
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
