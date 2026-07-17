import type { ReactNode } from "react";

/**
 * The shared bottom-of-page chrome for every view. `poweredBy` is rendered
 * after a "Powered by" prefix (each tool passes its own accent-coloured repo
 * link plus any note); `right` is the trailing licence/attribution text. The
 * bar itself lives here so the four tool pages and the docs shell never drift.
 */
export function SiteFooter({
  poweredBy,
  right,
}: {
  poweredBy: ReactNode;
  right: ReactNode;
}) {
  return (
    <footer className="mt-auto border-t border-border py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-xs text-muted sm:px-6">
        <span>Powered by {poweredBy}</span>
        <span>{right}</span>
      </div>
    </footer>
  );
}
