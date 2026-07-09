"use client";

import { useState } from "react";
import {
  CATEGORY_COMPOSITION_TIPS,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  DATASET_SIZE_GUIDE,
  TARGET_CATEGORIES,
  type TargetCategory,
} from "@/components/curator/types";

/**
 * Live, embeddable widget for the Target Category doc page. It drives the SAME
 * curator constants the Curate tool uses (CATEGORY_* / DATASET_SIZE_GUIDE), so
 * the docs demonstrate real behaviour rather than a copy. Picking a category
 * updates the description, "what good input looks like" tip, and the suggested
 * dataset size — exactly what the Curate scorer optimises for.
 */
export function TargetCategoryDemo() {
  const [category, setCategory] = useState<TargetCategory>("identity");
  const guide = DATASET_SIZE_GUIDE[category];

  return (
    <div className="not-prose my-6 rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">
          Try it
        </span>
        <span className="text-xs text-muted">live from the Curate scorer</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TARGET_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            aria-pressed={category === cat}
            className={
              category === cat
                ? "cursor-pointer rounded-lg bg-accent-purple px-3 py-1.5 text-sm font-medium text-white"
                : "cursor-pointer rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-hover"
            }
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
            What it trains
          </dt>
          <dd className="mt-1 text-foreground/80">{CATEGORY_DESCRIPTIONS[category]}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
            What good input looks like
          </dt>
          <dd className="mt-1 text-foreground/80">{CATEGORY_COMPOSITION_TIPS[category]}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
            Suggested set size
          </dt>
          <dd className="mt-1 text-foreground/80">
            ~{guide.ideal} sharp, varied images
          </dd>
        </div>
      </dl>
    </div>
  );
}
