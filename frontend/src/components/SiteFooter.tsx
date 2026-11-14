import type { ReactNode } from "react";
import { SuiteLinks } from "@/components/SuiteLinks";

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
      <SuiteLinks />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 text-xs text-muted sm:px-6">
        {/* Underlined: the repo link sits in running text, so colour alone can't mark it. */}
        <span className="[&_a]:underline [&_a]:underline-offset-2">Powered by {poweredBy}</span>
        <span className="[&_a]:underline [&_a]:underline-offset-2">{right}</span>
      </div>
    </footer>
  );
}
