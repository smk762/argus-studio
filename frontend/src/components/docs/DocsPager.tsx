"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsPager } from "@/components/docs/docsNav";

/** Previous / next links at the foot of a doc page, from the nav manifest order. */
export function DocsPager() {
  const pathname = usePathname();
  const { prev, next } = docsPager(pathname);
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Pagination"
      className="mt-12 grid gap-3 border-t border-border pt-6 sm:grid-cols-2"
    >
      {prev ? (
        <Link
          href={prev.href}
          className="group rounded-lg border border-border bg-surface/40 px-4 py-3 transition-colors hover:bg-surface-hover"
        >
          <span className="text-xs text-muted">← Previous</span>
          <span className="mt-0.5 block text-sm font-medium text-foreground group-hover:text-accent-purple">
            {prev.label}
          </span>
        </Link>
      ) : (
        // Keep the grid balanced so `next` stays right-aligned when alone.
        <span className="hidden sm:block" />
      )}
      {next && (
        <Link
          href={next.href}
          className="group rounded-lg border border-border bg-surface/40 px-4 py-3 text-right transition-colors hover:bg-surface-hover sm:col-start-2"
        >
          <span className="text-xs text-muted">Next →</span>
          <span className="mt-0.5 block text-sm font-medium text-foreground group-hover:text-accent-purple">
            {next.label}
          </span>
        </Link>
      )}
    </nav>
  );
}
