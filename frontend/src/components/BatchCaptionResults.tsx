"use client";

import { useMemo, useState } from "react";
import type { BatchCaptionResult } from "@/types";
import { toJsonl } from "@/lib/jsonl";
import { downloadText } from "@/lib/download";
import { activeCount, facetGroups, filterRows, hasBuckets, toggleTerm, type Selection } from "@/lib/captionFacets";
import { CaptionFacets } from "@/components/CaptionFacets";

interface Props {
  result: BatchCaptionResult;
  /** Human label for the source (folder path or manifest filename). */
  source: string;
}

/** Renders the per-image results of a /caption/folder or /caption/manifest run. */
export function BatchCaptionResults({ result, source }: Props) {
  const [copied, setCopied] = useState(false);
  const [selection, setSelection] = useState<Selection>({});

  // A new source is a new run: drop its filters. A streaming run keeps them
  // while rows arrive (same source, growing result).
  const [shownSource, setShownSource] = useState(source);
  if (shownSource !== source) {
    setShownSource(source);
    setSelection({});
  }

  const faceted = useMemo(() => hasBuckets(result.results), [result.results]);
  const groups = useMemo(() => (faceted ? facetGroups(result.results) : []), [faceted, result.results]);
  const rows = useMemo(() => filterRows(result.results, selection), [result.results, selection]);
  const filtering = activeCount(selection) > 0;

  // The export is every row's caption, as before: buckets are for filtering here,
  // not part of the captions.jsonl format.
  const asJsonl = toJsonl(
    result.results.map((r) => ({ rel_path: r.rel_path, final_caption: r.final_caption, ...(r.xmp_path ? { xmp_path: r.xmp_path } : {}) })),
  );

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(asJsonl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const download = () => downloadText("captions.jsonl", asJsonl + "\n", "application/x-ndjson");

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4">
        <Stat label="Captioned" value={result.captioned} tone="text-accent-green-ink" />
        <Stat label="Failed" value={result.failed} tone={result.failed ? "text-accent-red-ink" : "text-muted"} />
        <Stat label="Total" value={result.total} tone="text-foreground" />
        <div className="min-w-0 flex-1 truncate text-right font-mono text-xs text-muted" title={source}>
          {source}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyAll}
            disabled={result.results.length === 0}
            className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-40"
          >
            {copied ? "Copied" : "Copy JSONL"}
          </button>
          <button
            type="button"
            onClick={download}
            disabled={result.results.length === 0}
            className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-40"
          >
            Download
          </button>
        </div>
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="rounded-lg border border-accent-red/30 bg-accent-red/5 p-3">
          <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent-red-ink">
            {result.errors.length} error{result.errors.length > 1 ? "s" : ""}
          </h3>
          <ul className="space-y-0.5 text-xs text-accent-red-ink">
            {result.errors.slice(0, 20).map((e, i) => (
              <li key={i} className="font-mono">
                <span className="text-accent-red-ink">{e.rel_path}</span>: {e.error}
              </li>
            ))}
            {result.errors.length > 20 && <li className="text-muted">…and {result.errors.length - 20} more</li>}
          </ul>
        </div>
      )}

      {/* Rows, with facets over lens's category buckets when it sent them */}
      {result.results.length > 0 && (
        <div className={faceted ? "grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]" : ""}>
        {faceted && (
          <CaptionFacets
            rows={result.results}
            groups={groups}
            selection={selection}
            onToggle={(group, term) => setSelection((cur) => toggleTerm(cur, group, term))}
            onClear={() => setSelection({})}
          />
        )}
        <div className="min-w-0 space-y-2">
        {filtering && (
          <p className="text-xs text-muted" role="status">
            Showing {rows.length} of {result.results.length} captions. Copy and Download still export every row.
          </p>
        )}
        <div className="scrollbar-thin max-h-[60vh] overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2 font-semibold">Image</th>
                <th className="px-3 py-2 font-semibold">final_caption</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rel_path} className="border-t border-border align-top hover:bg-surface-hover/50">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-accent-purple-ink">{r.rel_path}</td>
                  <td className="px-3 py-2 leading-relaxed text-foreground/90">{r.final_caption}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">No caption matches these filters.</p>}
        </div>
        </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`font-mono text-lg font-bold tabular-nums ${tone}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
    </div>
  );
}
