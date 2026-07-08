import Link from "next/link";

/** The suite's top-level views, in nav order. */
const NAV = [
  { href: "/", label: "Caption" },
  { href: "/curate", label: "Curate" },
  { href: "/gallery", label: "Gallery" },
  { href: "/proof", label: "Proof" },
] as const;

/**
 * Shared top-nav used by every page's header. `active` is the current route's
 * href (e.g. "/proof"); that tab renders as the highlighted pill. Centralizing
 * it here keeps the four pages from drifting when a tab is added or restyled.
 */
export function Nav({ active }: { active: string }) {
  return (
    <nav className="flex items-center gap-1">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={
            n.href === active
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
