"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "@/components/ExternalLink";
import { DOCS_NAV, isExternalItem } from "@/components/docs/docsNav";

const ITEM = "block rounded-md border-l-2 px-3 py-1.5 text-sm";
const IDLE = `${ITEM} border-transparent text-muted transition-colors hover:bg-surface-hover hover:text-foreground`;

/** Left-rail navigation for the docs handbook; highlights the current page. */
export function DocsSidebar() {
  const pathname = usePathname();
  return (
    <nav className="space-y-6" aria-label="Documentation">
      {DOCS_NAV.map((section) => (
        <div key={section.title}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              // Off-site (the suite docs on docs.dragonhound.dev): never the current page.
              if (isExternalItem(item)) {
                return (
                  <li key={item.href}>
                    <ExternalLink href={item.href} className={IDLE}>
                      {item.label} <span aria-hidden>↗</span>
                    </ExternalLink>
                  </li>
                );
              }
              const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
              const active = path === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={active ? `${ITEM} border-accent-purple bg-surface text-foreground` : IDLE}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
