"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsPager } from "@/components/docs/docsNav";

/** Docs › Section › Page trail for the current route. Hidden on the overview. */
export function DocsBreadcrumb() {
  const pathname = usePathname();
  const { current } = docsPager(pathname);
  // Nothing to show at the root, or on a page not in the manifest.
  if (!current || current.href === "/docs") return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-muted">
      <Link href="/docs" className="transition-colors hover:text-foreground">
        Docs
      </Link>
      <span aria-hidden>/</span>
      <span>{current.section}</span>
      <span aria-hidden>/</span>
      <span className="text-foreground/80">{current.label}</span>
    </nav>
  );
}
