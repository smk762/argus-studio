"use client";

import { useState } from "react";
import { TARGET_BACKENDS } from "@/types";

/**
 * Live, embeddable widget for the Target Backend doc page. It reads the SAME
 * `TARGET_BACKENDS` constant that drives the Caption tool's Target Backend
 * dropdown, so the budgets shown here are the ones the tool actually sends.
 *
 * The point it makes visually: a caption is assembled to fit the selected
 * backend's budget, so the same caption is generous on Flux and lossy on SDXL.
 */

/** A representative assembled caption, longest-priority fragment first. */
const FRAGMENTS: { text: string; tokens: number; priority: string }[] = [
  { text: "trigger word + identity tags", tokens: 18, priority: "identity" },
  { text: "wardrobe / garment tags", tokens: 22, priority: "wardrobe" },
  { text: "pose and framing", tokens: 20, priority: "pose" },
  { text: "setting and background", tokens: 34, priority: "setting" },
  { text: "lighting and mood", tokens: 26, priority: "lighting" },
  { text: "appended prose tokens", tokens: 40, priority: "prose" },
];

const TOTAL = FRAGMENTS.reduce((n, f) => n + f.tokens, 0);

export function TokenBudgetDemo() {
  const [backend, setBackend] = useState<string>(TARGET_BACKENDS[0].value);
  const selected = TARGET_BACKENDS.find((b) => b.value === backend) ?? TARGET_BACKENDS[0];
  const budget = selected.tokens;

  // Assemble the fragments highest-priority-first, stopping the moment the
  // budget overflows — a caption is truncated at the tail, never packed
  // greedily, so once one fragment is dropped every lower-priority one is too.
  // A plain loop rather than a mutating `map` callback: the running totals stay
  // local to the loop instead of being reassigned from inside a closure.
  const rows: ((typeof FRAGMENTS)[number] & { fits: boolean })[] = [];
  for (let spent = 0, i = 0; i < FRAGMENTS.length; i++) {
    const f = FRAGMENTS[i];
    const fits = spent + f.tokens <= budget && (i === 0 || rows[i - 1].fits);
    if (fits) spent += f.tokens;
    rows.push({ ...f, fits });
  }
  const dropped = rows.filter((r) => !r.fits).length;

  return (
    <div className="not-prose my-6 rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">Try it</span>
        <span className="text-xs text-muted">budgets from the Caption tool</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TARGET_BACKENDS.map((b) => (
          <button
            key={b.value}
            type="button"
            onClick={() => setBackend(b.value)}
            aria-pressed={backend === b.value}
            className={
              backend === b.value
                ? "cursor-pointer rounded-lg bg-accent-purple px-3 py-1.5 text-sm font-medium text-white"
                : "cursor-pointer rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-hover"
            }
          >
            {b.label}
          </button>
        ))}
      </div>

      <p className="mb-3 text-sm text-foreground/80">
        <span className="font-mono text-accent-teal/90">{selected.value}</span> gives you{" "}
        <span className="font-semibold text-foreground">{budget} tokens</span>. This example caption
        wants {TOTAL} —{" "}
        {dropped === 0 ? (
          <span className="text-accent-green">everything fits.</span>
        ) : (
          <span className="text-accent-amber">
            the {dropped} lowest-priority {dropped === 1 ? "fragment is" : "fragments are"} dropped.
          </span>
        )}
      </p>

      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.priority} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className={`h-2 shrink-0 rounded-full ${r.fits ? "bg-accent-purple" : "bg-border"}`}
              style={{ width: `${(r.tokens / TOTAL) * 60}%` }}
            />
            <span className={r.fits ? "text-foreground/80" : "text-muted line-through"}>
              {!r.fits && <span className="sr-only">dropped: </span>}
              {r.text}
            </span>
            <span className="ml-auto shrink-0 font-mono text-xs text-muted">{r.tokens}t</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted">
        Fragment sizes are illustrative; the budgets are real. Ordering is by training priority —
        identity survives, prose is spent last.
      </p>
    </div>
  );
}
