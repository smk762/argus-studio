"use client";

import { useState } from "react";
import { DemoCard, SegmentedButtons } from "@/components/docs/DemoPrimitives";
import { TARGET_BACKENDS } from "@/types";
import { packFragments } from "@/lib/fragmentPacking";

/**
 * Live, embeddable widget for the Target Backend doc page. It reads the SAME
 * `TARGET_BACKENDS` table the Caption tool falls back on (`tokenBudget` in
 * `lib/captionTokens.ts`). The docs have no lens to ask, so this stays static.
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

  // Assemble the fragments highest-priority-first. Like lens's packing, a
  // fragment that doesn't fit is skipped and the next one still gets its chance,
  // so the dropped ones are named rather than called the lowest-priority tail.
  const rows = packFragments(FRAGMENTS, budget);
  const droppedNames = rows.filter((r) => !r.fits).map((r) => r.priority);
  const dropped = droppedNames.length;

  return (
    <DemoCard aside="budgets from the Caption tool">

      <SegmentedButtons label="Target backend" options={TARGET_BACKENDS} value={backend} onChange={setBackend} />

      <p className="mb-3 text-sm text-foreground/80">
        <span className="font-mono text-accent-teal-ink">{selected.value}</span> gives you{" "}
        <span className="font-semibold text-foreground">{budget} tokens</span>. This example caption
        wants {TOTAL} —{" "}
        {dropped === 0 ? (
          <span className="text-accent-green-ink">everything fits.</span>
        ) : (
          <span className="text-accent-amber-ink">
            {dropped === 1 ? "this fragment doesn't" : "these fragments don't"} fit and{" "}
            {dropped === 1 ? "is" : "are"} skipped: {droppedNames.join(", ")}.
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
        Fragment sizes are illustrative; the budgets are real. Fragments are placed in training-priority
        order, identity first and prose last; one that does not fit is skipped, and a smaller one after it
        can still fit.
      </p>
    </DemoCard>
  );
}
