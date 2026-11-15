"use client";

import { useState } from "react";
import type { BatchCaptionRow } from "@/types";
import { activeCount, facetCounts, groupLabel, type FacetTerm, type Selection } from "@/lib/captionFacets";

const COLLAPSED_LIMIT = 8;

function FacetGroup({
  group,
  terms,
  onToggle,
}: {
  group: string;
  terms: FacetTerm[];
  onToggle: (group: string, term: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (terms.length === 0) return null;
  const visible = expanded ? terms : terms.slice(0, COLLAPSED_LIMIT);
  const active = terms.filter((t) => t.selected).length;
  return (
    <details open className="group/facet border-t border-border py-2 first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded px-1 py-1 hover:bg-surface-hover [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block w-3 text-xs text-muted transition-transform group-open/facet:rotate-90">
          ›
        </span>
        <h4 className="text-xs font-semibold text-foreground/80">{groupLabel(group)}</h4>
        {active > 0 && (
          <span className="ml-auto rounded-full bg-accent-purple/15 px-1.5 text-[10px] tabular-nums text-accent-purple-ink">
            {active}
            <span className="sr-only"> selected</span>
          </span>
        )}
      </summary>
      <ul className="mt-1 space-y-0.5">
        {visible.map(({ term, count, selected }) => (
          <li key={term}>
            <label
              className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-surface-hover ${
                count === 0 && !selected ? "opacity-40" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(group, term)}
                className="accent-accent-purple"
              />
              <span className="min-w-0 flex-1 truncate text-foreground/90">{term}</span>
              <span className="tabular-nums text-muted">{count}</span>
            </label>
          </li>
        ))}
      </ul>
      {terms.length > COLLAPSED_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 px-1.5 text-[11px] text-muted hover:text-foreground"
        >
          {expanded ? "Show fewer" : `Show all ${terms.length}`}
        </button>
      )}
    </details>
  );
}

/**
 * Filter batch captions by the tags lens filed under each caption category
 * (#118). Any term within a category, every category with a selection.
 */
export function CaptionFacets({
  rows,
  groups,
  selection,
  onToggle,
  onClear,
}: {
  rows: readonly BatchCaptionRow[];
  groups: string[];
  selection: Selection;
  onToggle: (group: string, term: string) => void;
  onClear: () => void;
}) {
  const active = activeCount(selection);
  return (
    <nav
      aria-label="Filter captions by category"
      className="scrollbar-thin max-h-[60vh] self-start overflow-y-auto rounded-lg border border-border bg-surface/40 p-2"
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted">Filter by tag</h3>
        {active > 0 && (
          <button type="button" onClick={onClear} className="text-[11px] text-accent-purple-ink hover:underline">
            Clear {active}
          </button>
        )}
      </div>
      {groups.map((group) => (
        <FacetGroup key={group} group={group} terms={facetCounts(rows, group, selection)} onToggle={onToggle} />
      ))}
    </nav>
  );
}
