import type { ReactNode } from "react";
import { HOME_URL, REPO_URL } from "@/lib/staticDemo";

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
          <a href={REPO_URL} className="text-accent-teal hover:underline">
            Run it yourself on GitHub
          </a>
          <span aria-hidden>·</span>
          <a href={HOME_URL} className="hover:text-foreground hover:underline">
            dragonhound.dev
          </a>
        </span>
      </div>
    </div>
  );
}

/**
 * The per-page "this is recorded" note. Every page that would otherwise call a
 * backend renders one of these above the recorded output, so a visitor never
 * mistakes a fixture for a live result.
 */
export function RecordedDemoNote({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-accent-amber/40 bg-accent-amber/10 px-4 py-2.5 text-xs leading-relaxed text-accent-amber">
      <span className="font-medium">Recorded demo</span>
      {children ? <> — {children}</> : null} Run it yourself:{" "}
      <a href={REPO_URL} className="underline hover:text-foreground">
        {REPO_URL.replace(/^https:\/\//, "")}
      </a>
    </div>
  );
}

/** The header pill a static-demo page shows in place of a live API version. */
export function RecordedBadge() {
  return (
    <div className="shrink-0 text-right">
      <span className="rounded-md border border-accent-amber/40 bg-accent-amber/10 px-2 py-1 text-[10px] uppercase tracking-wider text-accent-amber">
        Recorded
      </span>
    </div>
  );
}
