"use client";

import { useMemo } from "react";
import { basename } from "@/lib/path";
import { canExport, exportBlockReason } from "@/lib/curatorSafety";
import { imagePending, pendingCaption } from "@/lib/scanChunks";
import { SafeThumb } from "./SafeThumb";
import type { ImageResult } from "./types";

interface Props {
  scanId: string;
  results: ImageResult[];
  nsfwRan: boolean;
  pending?: readonly string[];
  selected: Set<string>;
  onToggle: (relPath: string) => void;
}

/** Side-by-side review of near-duplicate clusters (group_size > 1) for HITL keep/drop. */
export function ClusterReviewLane({ scanId, results, nsfwRan, pending = [], selected, onToggle }: Props) {
  const groups = useMemo(() => {
    const byGroup = new Map<number, ImageResult[]>();
    for (const r of results) {
      if (r.group_size > 1) {
        const arr = byGroup.get(r.similar_group) ?? [];
        arr.push(r);
        byGroup.set(r.similar_group, arr);
      }
    }
    return [...byGroup.entries()]
      .map(([id, members]) => ({
        id,
        members: members.sort((a, b) => b.score - a.score),
      }))
      .sort((a, b) => a.id - b.id);
  }, [results]);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 text-sm text-muted">
        No near-duplicate clusters in this scan. Loosen the pHash distance to surface more.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-relaxed text-muted">
        Each row is a near-duplicate cluster. The representative (highest score, marked{" "}
        <span className="font-mono text-accent-amber">*</span>) is kept by default; tick the ones you actually want in
        the export.
      </p>
      {groups.map((g) => (
        <div key={g.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded bg-accent-amber/20 px-2 py-0.5 font-mono text-xs text-accent-amber">g{g.id}</span>
            <span className="text-xs text-muted">{g.members.length} near-duplicates</span>
          </div>
          <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-1">
            {g.members.map((m) => {
              const isSel = selected.has(m.rel_path);
              const exportable = canExport(m);
              const blocked = exportBlockReason(m);
              const waiting = imagePending(m, pending);
              return (
                <div
                  key={m.rel_path}
                  title={blocked ?? m.rel_path}
                  className={`relative w-32 shrink-0 overflow-hidden rounded-lg border text-left transition-all ${
                    isSel
                      ? "border-accent-green/70 ring-2 ring-accent-green/40"
                      : "border-border hover:border-accent-teal/40"
                  }`}
                >
                  <div className="relative aspect-square">
                    <SafeThumb
                      scanId={scanId}
                      img={m}
                      nsfwRan={nsfwRan}
                      pending={pending}
                      onActivate={exportable ? () => onToggle(m.rel_path) : undefined}
                    />
                    <span className="pointer-events-none absolute right-1 top-1 z-10 rounded bg-black/50 px-1 py-0.5 font-mono text-[10px] text-white">
                      {m.score.toFixed(2)}
                    </span>
                    {m.is_representative && (
                      <span className="pointer-events-none absolute left-1 top-1 z-10 rounded bg-accent-amber/80 px-1 py-0.5 font-mono text-[10px] text-black">
                        rep*
                      </span>
                    )}
                    {exportable && (
                      <span
                        className={`pointer-events-none absolute bottom-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded border text-[11px] font-bold ${
                          isSel ? "border-accent-green bg-accent-green text-black" : "border-white/50 bg-black/40 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="truncate p-1.5 font-mono text-[9px] text-muted" title={m.rel_path}>
                    {basename(m.rel_path)}
                  </div>
                  {waiting.length > 0 && (
                    <div className="truncate px-1.5 pb-1.5 text-[9px] text-accent-teal">Checking {pendingCaption(waiting)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
