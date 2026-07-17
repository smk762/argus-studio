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
  }, [pathname]);

  // Scroll-spy: highlight the last heading scrolled past the top band.
  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      // Trigger as a heading crosses the upper quarter of the viewport.
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
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
