"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { previewKeepSet } from "@/lib/curatorApi";
import { capProblem, facetsNotSent, keptPaths, leftOutReasons, selectBody } from "@/lib/curatorKeepSet";
import type { CapOptions, CuratorFilters, ScanSummary, SelectRequest, SelectResult } from "./types";

interface Props {
  summary: ScanSummary;
  /** The rail's facets, as the grid applies them. */
  filters: CuratorFilters;
  disabled: boolean;
  onUse: (relPaths: string[]) => void;
  /** Why a live export cannot go right now, or null. */
  exportBlocked: string | null;
  /** Export without a selection: the curator trims its keep set to the cap. */
  onExportCapped: (request: SelectRequest & CapOptions) => void;
}

/**
 * Asks the curator what these facets would keep. Nothing is written. Counts and
 * reasons only, so a frame covered in the grid stays covered here.
 */
export function KeepSetPanel({ summary, filters, disabled, onUse, exportBlocked, onExportCapped }: Props) {
  const [keepSimilar, setKeepSimilar] = useState(false);
  const [maxKeep, setMaxKeep] = useState("");
  const [spreadScenes, setSpreadScenes] = useState(false);
  const [spreadOutfits, setSpreadOutfits] = useState(false);
  const [preview, setPreview] = useState<{ key: string; result: SelectResult } | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const body = useMemo(() => selectBody(filters, keepSimilar, summary), [filters, keepSimilar, summary]);
  // A delete or a move changes the scan under the same filters.
  const key = `${JSON.stringify(body)}|${summary.total}`;
  const fresh = preview?.key === key;
  const notSent = facetsNotSent(filters);
  const reasons = useMemo(() => (preview ? leftOutReasons(preview.result) : []), [preview]);
  const usable = useMemo(
    () => (preview ? keptPaths(preview.result, summary.results) : []),
    [preview, summary.results],
  );

  const scenesRan = summary.scenes_config?.enabled === true;
  const garmentsRan = summary.garments_config?.enabled === true;
  const cap: CapOptions = {
    max_keep: maxKeep.trim() === "" ? null : Number(maxKeep),
    diversify_scenes: scenesRan && spreadScenes,
    diversify_outfits: garmentsRan && spreadOutfits,
  };
  const capBlocked = capProblem(cap, fresh, preview?.result.kept ?? 0, usable.length) ?? exportBlocked;

  const ask = async () => {
    request.current?.abort();
    const ctrl = new AbortController();
    request.current = ctrl;
    setAsking(true);
    setError(null);
    try {
      setPreview({ key, result: await previewKeepSet(summary.scan_id, body, ctrl.signal) });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setPreview(null);
      setError(err instanceof Error ? err.message : "Could not preview the keep set");
    } finally {
      if (request.current === ctrl) setAsking(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/60 p-2.5">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">Keep-set preview</span>
      <p className="text-[11px] leading-relaxed text-muted">
        Asks the curator what the facets on this page would keep. Nothing is written.
      </p>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={keepSimilar}
          onChange={(e) => setKeepSimilar(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 cursor-pointer accent-accent-teal disabled:cursor-not-allowed disabled:opacity-50"
        />
        Keep near-duplicates
      </label>
      {notSent.length > 0 && (
        <p className="text-[11px] leading-relaxed text-accent-orange/90">
          The curator has no filter for {notSent.join(" or ")}, so the preview leaves {notSent.length === 1 ? "it" : "them"} out.
        </p>
      )}
      <button
        type="button"
        onClick={() => void ask()}
        disabled={disabled || asking}
        className="w-full cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {asking ? "Asking…" : "Preview keep set"}
      </button>
      {error && <p className="text-[11px] leading-relaxed text-accent-red">{error}</p>}
      {preview && (
        <div className="space-y-1.5">
          <p className="text-xs text-foreground">
            Keeps {preview.result.kept} of {preview.result.total}.
            {!fresh && <span className="text-accent-orange/90"> The facets changed, so preview again.</span>}
          </p>
          {reasons.length > 0 && (
            <ul className="space-y-0.5">
              {reasons.map((entry) => (
                <li key={entry.reason} className="flex justify-between gap-2 text-[11px] text-muted" title={entry.reason}>
                  <span className="min-w-0 truncate">{entry.label}</span>
                  <span className="shrink-0 font-mono tabular-nums">{entry.count}</span>
                </li>
              ))}
            </ul>
          )}
          {usable.length < preview.result.kept && (
            <p className="text-[11px] leading-relaxed text-accent-orange/90">
              {preview.result.kept - usable.length} kept by the curator cannot be selected here.
            </p>
          )}
          <button
            type="button"
            onClick={() => onUse(usable)}
            disabled={disabled || !fresh || usable.length === 0}
            className="w-full cursor-pointer rounded-lg border border-accent-green/40 bg-accent-green/10 px-3 py-1.5 text-xs font-medium text-accent-green transition-colors hover:bg-accent-green/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Use as selection ({usable.length})
          </button>
          <div className="space-y-1.5 border-t border-border pt-2">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">Cap the set</span>
            <p className="text-[11px] leading-relaxed text-muted">
              Only an export trims by diversity, so the curator picks the frames as it writes them. Your selection is not used.
            </p>
            <label className="flex items-center gap-2 text-xs text-foreground">
              Keep at most
              <input
                type="number"
                min={1}
                step={1}
                value={maxKeep}
                onChange={(e) => setMaxKeep(e.target.value)}
                disabled={disabled}
                className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-accent-teal/50 focus:outline-none disabled:opacity-50"
              />
            </label>
            {scenesRan && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={spreadScenes}
                  onChange={(e) => setSpreadScenes(e.target.checked)}
                  disabled={disabled}
                  className="h-4 w-4 cursor-pointer accent-accent-teal"
                />
                Spread across scenes
              </label>
            )}
            {garmentsRan && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={spreadOutfits}
                  onChange={(e) => setSpreadOutfits(e.target.checked)}
                  disabled={disabled}
                  className="h-4 w-4 cursor-pointer accent-accent-teal"
                />
                Spread across outfits
              </label>
            )}
            <button
              type="button"
              onClick={() => onExportCapped({ ...body, ...cap })}
              disabled={disabled || capBlocked !== null}
              title={capBlocked ?? undefined}
              className="w-full cursor-pointer rounded-lg border border-accent-green/40 px-3 py-1.5 text-xs font-medium text-accent-green transition-colors hover:bg-accent-green/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Export capped set + manifest
            </button>
            {capBlocked && <p className="text-[11px] leading-relaxed text-muted">{capBlocked}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
