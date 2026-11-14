import type { ReactNode } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { stageFor, type StageTone } from "@/lib/pipeline";

// Full class strings (not interpolated fragments) so Tailwind's JIT keeps them.
const LOGO_TONES: Record<StageTone, { box: string; text: string }> = {
  purple: { box: "border-accent-purple/40 bg-accent-purple/20", text: "text-accent-purple-ink" },
  teal: { box: "border-accent-teal/40 bg-accent-teal/20", text: "text-accent-teal-ink" },
  amber: { box: "border-accent-amber/40 bg-accent-amber/20", text: "text-accent-amber-ink" },
  green: { box: "border-accent-green/40 bg-accent-green/20", text: "text-accent-green-ink" },
  blue: { box: "border-accent-blue/40 bg-accent-blue/20", text: "text-accent-blue-ink" },
};

/**
 * The argus-studio package mark (brand/argus-studio-mono.svg, from argus-cortex
 * brand/packages/studio), inline in currentColor so it follows the theme.
 */
function StudioMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <path d="M3 8.5h18" />
      </g>
      <circle cx="12" cy="14.25" r="2.25" fill="currentColor" />
    </svg>
  );
}

/**
 * The shared top-of-page chrome for every view: the bar, the {@link Nav}
 * tabs, and the branded logo/title block. The right-hand `badge` slot is the
 * only per-page piece — each tool passes its own (stateful) API/version pill —
 * so the surrounding chrome lives in exactly one place.
 *
 * Layout: from `xl` up it is one row (tabs · title · badge and theme). Below
 * that the eight tabs no longer fit beside the title, so a grid puts the title
 * and badge on the first row and the tabs on a second, sideways-scrolling row.
 * The DOM order stays tabs → title → badge in both, so Tab order is the same at
 * every width. On phones the header is not sticky and drops the subtitle, so it
 * costs about two short rows instead of the whole first screen.
 */
export function SiteHeader({
  active,
  logo,
  title,
  subtitle,
  badge,
  titleAs: Title = "h1",
}: {
  /** Current route path, forwarded to {@link Nav} for tab highlighting and used
   *  to resolve this page's accent from the one PIPELINE definition. */
  active: string;
  logo: { letter: string };
  title: string;
  subtitle: string;
  /** Per-page API/version status pill rendered at the right edge. */
  badge?: ReactNode;
  /** The title's element. "h1" on the tool pages; docs pass "p", since each docs page has its own h1. */
  titleAs?: "h1" | "p";
}) {
  // The badge accent is the stage's own pipeline tone, so a page's colour is
  // defined once (in PIPELINE) rather than re-stated at every SiteHeader call.
  const tone = LOGO_TONES[stageFor(active)?.tone ?? "purple"];
  return (
    <header className="z-10 border-b border-border bg-surface/50 backdrop-blur-sm md:sticky md:top-0">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:py-4">
        <div className="col-span-2 row-start-2 min-w-0 xl:col-span-1 xl:col-start-1 xl:row-start-1">
          <Nav active={active} />
        </div>
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-3 xl:col-start-2">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${tone.box}`}
          >
            <span className={`text-sm font-bold ${tone.text}`}>{logo.letter}</span>
          </div>
          <div className="min-w-0">
            {/* The product name over the tool name (S7): a small mark-and-wordmark link home. */}
            <Link
              href="/"
              className="flex w-fit items-center gap-1 text-[11px] font-medium leading-none text-muted hover:text-foreground"
            >
              <StudioMark className="h-3 w-3 shrink-0" />
              Argus Studio
            </Link>
            <Title className="mt-0.5 truncate text-lg font-semibold leading-tight text-foreground">{title}</Title>
            <p className="hidden truncate text-xs text-muted sm:block" title={subtitle}>
              {subtitle}
            </p>
          </div>
        </div>
        <div className="col-start-2 row-start-1 flex shrink-0 items-center gap-3 xl:col-start-3">
          {badge}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
