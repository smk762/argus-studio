"use client";

import type { ReactNode } from "react";

/**
 * Shared chrome for the interactive docs widgets (#48): the "Try it" card,
 * a single-choice button row, an on/off switch and the labelled fact rows.
 * Presentational only; each widget keeps its own state and data.
 */

/** The card every docs widget sits in, with its "Try it" header. `aside` fills the header's right side. */
export function DemoCard({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="not-prose my-6 rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">Try it</span>
        {typeof aside === "string" ? <span className="text-xs text-muted">{aside}</span> : aside}
      </div>
      {children}
    </div>
  );
}

/**
 * One choice from a row of buttons, each `aria-pressed`. `label` names the
 * group for assistive tech, since the buttons alone don't say what they pick.
 */
export function SegmentedButtons<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="mb-4 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={
            value === o.value
              ? "cursor-pointer rounded-lg bg-accent-purple px-3 py-1.5 text-sm font-medium text-on-accent"
              : "cursor-pointer rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-hover"
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** An on/off switch (`role="switch"`) with a visible label beside it. */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Shown beside the switch. */
  label: ReactNode;
  /** The switch's accessible name, when the visible label isn't one (e.g. a parameter name). */
  ariaLabel?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 cursor-pointer rounded-full transition-colors ${
          checked ? "bg-accent-purple" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform motion-reduce:transition-none ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

/** The term/description list under a widget's controls. */
export function DemoFacts({ children }: { children: ReactNode }) {
  return <dl className="space-y-3 text-sm">{children}</dl>;
}

/** One labelled row of {@link DemoFacts}. `className` styles the value (plain text by default). */
export function DemoFact({
  term,
  children,
  className = "text-foreground/80",
}: {
  term: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{term}</dt>
      <dd className={`mt-1 ${className}`}>{children}</dd>
    </div>
  );
}
