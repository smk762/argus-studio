import type { ReactNode } from "react";
import { HOME_URL, REPO_URL } from "@/lib/staticDemo";
import { ExternalLink } from "@/components/ExternalLink";

/**
 * The thin strip above every page of the static demo export. Rendered by the
 * root layout only when STATIC_DEMO is set, so the normal build is untouched.
 */
export function DemoBanner() {
  return (
    <div className="border-b border-border bg-surface/80 text-[11px] text-muted">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 sm:px-6">
        <span>
          <span className="font-medium text-foreground/80">Static demo</span> — recorded outputs, no live backends.
        </span>
        <span className="flex items-center gap-3">
          <ExternalLink href={REPO_URL} className="text-accent-teal hover:underline">
            Run it yourself on GitHub
          </ExternalLink>
          <span aria-hidden>·</span>
          <ExternalLink href={HOME_URL} className="hover:text-foreground hover:underline">
            dragonhound.dev
          </ExternalLink>
        </span>
      </div>
    </div>
  );
}

/**
 * The per-page "this is recorded" note: one quiet line under the page title.
 * {@link DemoBanner} already says the whole site is a demo, so this only names
 * what kind of non-live data the page shows. The long provenance text goes in
 * `children`, folded into a native `<details>` disclosure (no script, so the
 * static export's hash CSP is unaffected). Muted text keeps 4.5:1 contrast in
 * both themes.
 */
export function RecordedDemoNote({
  label = "Recorded demo",
  summary,
  children,
}: {
  /** Leading label: what kind of non-live data the page shows. */
  label?: string;
  /** The rest of the one-line note. */
  summary?: ReactNode;
  /** Long provenance text, shown on demand. */
  children?: ReactNode;
}) {
  const line = (
    <>
      <span className="font-medium text-foreground/80">{label}</span>
      {summary ? <> — {summary}</> : null}
    </>
  );
  const runIt = (
    <>
      Run it yourself:{" "}
      <ExternalLink href={REPO_URL} className="underline underline-offset-2 hover:text-foreground">
        {REPO_URL.replace(/^https:\/\//, "")}
      </ExternalLink>
    </>
  );
  if (!children) {
    return (
      <p role="note" className="text-xs leading-relaxed text-muted">
        {line}. {runIt}
      </p>
    );
  }
  return (
    <details className="group text-xs leading-relaxed text-muted">
      <summary className="cursor-pointer list-none select-none hover:text-foreground/80 [&::-webkit-details-marker]:hidden">
        {line}{" "}
        <span className="whitespace-nowrap underline underline-offset-2">
          <span className="group-open:hidden">Details</span>
          <span className="hidden group-open:inline">Hide details</span>
        </span>
      </summary>
      <div className="mt-2 max-w-3xl space-y-1.5 border-l border-border pl-3">
        <div>{children}</div>
        <div>{runIt}</div>
      </div>
    </details>
  );
}

/**
 * The header pill a demo page shows in place of a live API version. Muted, not
 * amber: it marks the state without competing with the page.
 */
export function RecordedBadge({ label = "Recorded", title }: { label?: string; title?: string }) {
  return (
    <div className="shrink-0 text-right">
      <span
        title={title ?? "Recorded output from a real run; no live backend in this build."}
        className="rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted"
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Data credits the licences require (Copernicus DEM, OpenStreetMap ODbL), as a
 * single footer line. Shared by every page that shows atlas output.
 */
export function AtlasDataCredits() {
  return (
    <>
      Terrain: Copernicus GLO-30 DEM (© DLR e.V., © Airbus DS, provided under COPERNICUS by the EU and ESA) · Map data ©{" "}
      <ExternalLink href="https://www.openstreetmap.org/copyright" className="underline underline-offset-2 hover:text-foreground">
        OpenStreetMap contributors
      </ExternalLink>{" "}
      (ODbL)
    </>
  );
}
