import type { ReactNode } from "react";
import { SuiteLinks } from "@/components/SuiteLinks";
import { ExternalLink } from "@/components/ExternalLink";
import { HOME_URL, LIGHTBOX_URL, REALMS_URL, REPO_URL, STATIC_DEMO } from "@/lib/staticDemo";

/**
 * The static demo's family row (S11): the landing page, the sibling demos and the
 * source. Family hosts open in the same tab (ExternalLink); GitHub opens a new one.
 * The self-hosted build shows its configured standalone UIs instead (SuiteLinks).
 */
function FamilyLinks() {
  return (
    <nav aria-label="Dragonhound Labs" className="mx-auto flex max-w-7xl flex-wrap gap-x-3 gap-y-1 px-4 pb-2 text-xs text-muted sm:px-6">
      <ExternalLink href={HOME_URL} className="underline underline-offset-2 hover:text-foreground">Dragonhound Labs</ExternalLink>
      <span aria-hidden>·</span>
      <span aria-current="true" className="font-medium text-foreground">Studio</span>
      <span aria-hidden>·</span>
      <ExternalLink href={LIGHTBOX_URL} className="underline underline-offset-2 hover:text-foreground">Lightbox</ExternalLink>
      <span aria-hidden>·</span>
      <ExternalLink href={REALMS_URL} className="underline underline-offset-2 hover:text-foreground">Realms</ExternalLink>
      <span aria-hidden>·</span>
      <ExternalLink href={REPO_URL} className="underline underline-offset-2 hover:text-foreground">GitHub</ExternalLink>
    </nav>
  );
}

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
      {STATIC_DEMO ? <FamilyLinks /> : <SuiteLinks />}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 text-xs text-muted sm:px-6">
        {/* Underlined: the repo link sits in running text, so colour alone can't mark it. */}
        <span className="[&_a]:underline [&_a]:underline-offset-2">Powered by {poweredBy}</span>
        <span className="[&_a]:underline [&_a]:underline-offset-2">{right}</span>
      </div>
    </footer>
  );
}
