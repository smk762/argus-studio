import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { stageFor, type StageTone } from "@/lib/pipeline";

// Full class strings (not interpolated fragments) so Tailwind's JIT keeps them.
const LOGO_TONES: Record<StageTone, { box: string; text: string }> = {
  purple: { box: "border-accent-purple/40 bg-accent-purple/20", text: "text-accent-purple" },
  teal: { box: "border-accent-teal/40 bg-accent-teal/20", text: "text-accent-teal" },
  amber: { box: "border-accent-amber/40 bg-accent-amber/20", text: "text-accent-amber" },
  green: { box: "border-accent-green/40 bg-accent-green/20", text: "text-accent-green" },
};

/**
 * The shared top-of-page chrome for every view: the sticky bar, the {@link Nav}
 * tabs, and the branded logo/title block. The right-hand `badge` slot is the
 * only per-page piece — each tool passes its own (stateful) API/version pill —
 * so the surrounding chrome lives in exactly one place.
 */
export function SiteHeader({
  active,
  logo,
  title,
  subtitle,
  badge,
}: {
  /** Current route path, forwarded to {@link Nav} for tab highlighting and used
   *  to resolve this page's accent from the one PIPELINE definition. */
  active: string;
  logo: { letter: string };
  title: string;
  subtitle: string;
  /** Per-page API/version status pill rendered at the right edge. */
  badge?: ReactNode;
}) {
  // The badge accent is the stage's own pipeline tone, so a page's colour is
  // defined once (in PIPELINE) rather than re-stated at every SiteHeader call.
  const tone = LOGO_TONES[stageFor(active)?.tone ?? "purple"];
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/50 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Nav active={active} />
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${tone.box}`}
            >
              <span className={`text-sm font-bold ${tone.text}`}>{logo.letter}</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-foreground">{title}</h1>
              <p className="text-xs text-muted">{subtitle}</p>
            </div>
          </div>
        </div>
        {badge}
      </div>
    </header>
  );
}
