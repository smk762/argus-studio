"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAV } from "@/components/docs/docsNav";

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
              const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
              const active = path === item.href;
              // A child page (a package's docs/*.md) highlights its parent, which lists it.
              const within = !active && (item.children ?? []).some((child) => child.href === path);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={
                      active || within
                        ? "block rounded-md border-l-2 border-accent-purple bg-surface px-3 py-1.5 text-sm text-foreground"
                        : "block rounded-md border-l-2 border-transparent px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                    }
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
