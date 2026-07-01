"use client";

import { ThumbImage } from "./ThumbImage";
import { FACE_POSES, POSE_LABELS, type CuratorFilters, type FacePose, type ScanSummary } from "./types";

interface Props {
  summary: ScanSummary;
  filters: CuratorFilters;
  onChange: (f: CuratorFilters) => void;
  visibleCount: number;
}

export function FacetRail({ summary, filters, onChange, visibleCount }: Props) {
  const set = (patch: Partial<CuratorFilters>) => onChange({ ...filters, ...patch });

  const toggleCluster = (id: string) => {
    const has = filters.faceClusters.includes(id);
    set({
      faceClusters: has
        ? filters.faceClusters.filter((c) => c !== id)
        : [...filters.faceClusters, id],
    });
  };

  const togglePose = (p: FacePose) => {
    const has = filters.poses.includes(p);
    set({ poses: has ? filters.poses.filter((x) => x !== p) : [...filters.poses, p] });
  };

  const hasFaces = summary.faces_config.enabled && summary.face_clusters.length > 0;

  const poseCounts = summary.results.reduce<Record<string, number>>((acc, r) => {
    if (r.primary_face_pose) acc[r.primary_face_pose] = (acc[r.primary_face_pose] ?? 0) + 1;
    return acc;
  }, {});
  const hasPoses = Object.keys(poseCounts).length > 0;

  return (
    <div className="space-y-5 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Facets</h3>
        <span className="text-[11px] text-muted">{visibleCount} shown</span>
      </div>

      {/* Face clusters */}
      {hasFaces && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Identity</span>
            {filters.faceClusters.length > 0 && (
              <button
                type="button"
                onClick={() => set({ faceClusters: [] })}
                className="cursor-pointer text-[10px] text-accent-teal hover:underline"
              >
                clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {summary.face_clusters.map((fc) => {
              const active = filters.faceClusters.includes(fc.cluster_id);
              return (
                <button
                  key={fc.cluster_id}
                  type="button"
                  onClick={() => toggleCluster(fc.cluster_id)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-1.5 text-left transition-all ${
                    active
                      ? "border-accent-teal/50 bg-accent-teal/10 ring-1 ring-accent-teal/40"
                      : "border-border bg-background hover:bg-surface-hover"
                  }`}
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md">
                    <ThumbImage
                      scanId={summary.scan_id}
                      relPath={fc.representative_rel_path}
                      faceCluster={fc.cluster_id}
                      rounded="rounded-md"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[11px] text-foreground">{fc.cluster_id}</div>
                    <div className="text-[10px] text-muted">{fc.size} faces</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Head pose */}
      {hasPoses && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Head pose</span>
            {filters.poses.length > 0 && (
              <button
                type="button"
                onClick={() => set({ poses: [] })}
                className="cursor-pointer text-[10px] text-accent-teal hover:underline"
              >
                clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {FACE_POSES.map((p) => {
              const active = filters.poses.includes(p);
              const count = poseCounts[p] ?? 0;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={count === 0}
                  onClick={() => togglePose(p)}
                  className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                    active
                      ? "border-accent-purple/50 bg-accent-purple/10 ring-1 ring-accent-purple/40"
                      : "border-border bg-background hover:bg-surface-hover"
                  }`}
                >
                  <span className="text-[11px] font-medium text-foreground">{POSE_LABELS[p]}</span>
                  <span className="font-mono text-[10px] text-muted">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Score range */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Min score</span>
          <span className="font-mono text-xs text-accent-teal">{filters.minScore.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={filters.minScore}
          onChange={(e) => set({ minScore: parseFloat(e.target.value) })}
          className="w-full cursor-pointer accent-accent-teal"
        />
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <Check label="Passed only" checked={filters.passedOnly} onChange={(v) => set({ passedOnly: v })} />
        <Check label="Hide near-duplicates" checked={filters.hideDuplicates} onChange={(v) => set({ hideDuplicates: v })} />
        {hasFaces && (
          <>
            <Check label="Single-face only" checked={filters.singleFaceOnly} onChange={(v) => set({ singleFaceOnly: v })} />
            <Check label="Require a known face" checked={filters.requireKnownFace} onChange={(v) => set({ requireKnownFace: v })} />
          </>
        )}
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-accent-teal"
      />
      {label}
    </label>
  );
}
