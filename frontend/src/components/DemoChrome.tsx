import type { ReactNode } from "react";
import { REPO_URL } from "@/lib/staticDemo";
import { ExternalLink } from "@/components/ExternalLink";

/**
 * The family's four demo states (dh-shared README, "Demo-state vocabulary"), styled
 * by vendor/dh/dh-badge.css. One per page, in the header, says what kind of data the
 * page shows; a control the demo can't run carries "off" beside it.
 */
export const DEMO_STATES = {
  recorded: { label: "Recorded", className: "dh-badge", title: "Recorded output from a real run; no model runs while you browse" },
  sample: { label: "Sample data", className: "dh-badge dh-badge--sample", title: "Synthetic sample to show the layout; not real output" },
  browser: { label: "In-browser", className: "dh-badge dh-badge--browser", title: "Runs in your browser; nothing is sent anywhere" },
  off: { label: "Not in this demo", className: "dh-badge dh-badge--off", title: "Needs the self-hosted backend; see the README" },
} as const;

export type DemoState = keyof typeof DEMO_STATES;

export function DemoBadge({ state, title }: { state: DemoState; title?: string }) {
  const s = DEMO_STATES[state];
  return (
    <span className={`${s.className} shrink-0`} title={title ?? s.title}>
      {s.label}
    </span>
  );
}

/**
 * The per-page demo note: one quiet line under the page title saying what the page
 * shows (the header badge already names the state, so the note doesn't repeat it).
 * The long provenance text goes in `children`, folded into a native `<details>`
 * disclosure (no script, so the static export's hash CSP is unaffected).
 */
export function RecordedDemoNote({
  summary,
  children,
}: {
  /** The one-line note, a full sentence. */
  summary: ReactNode;
  /** Long provenance text, shown on demand. */
  children?: ReactNode;
}) {
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
        {summary} {runIt}
      </p>
    );
  }
  return (
    <details className="group text-xs leading-relaxed text-muted">
      <summary className="cursor-pointer list-none select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
        {summary}{" "}
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
