"use client";

import { useEffect } from "react";
import { ThumbImage } from "./ThumbImage";
import { formatScoreBreakdown, statusExplanation } from "./imageExplain";
import type { ImageResult } from "./types";

interface Props {
  scanId: string;
  img: ImageResult | null;
  selected: boolean;
  onToggle: (relPath: string) => void;
  onClose: () => void;
}

export function ImageDetailModal({ scanId, img, selected, onToggle, onClose }: Props) {
  useEffect(() => {
    if (!img) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [img, onClose]);

  if (!img) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="curator-detail-title"
      onClick={onClose}
    >
      <div
        className="scrollbar-thin max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-border bg-surface/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2 id="curator-detail-title" className="truncate text-sm font-semibold text-foreground">
              {img.rel_path}
            </h2>
            <p className="mt-0.5 text-xs text-muted">{statusExplanation(img)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onToggle(img.rel_path)}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                selected
                  ? "border-accent-green/50 bg-accent-green/20 text-accent-green"
                  : "border-border text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              {selected ? "Selected" : "Select"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-6 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="aspect-square overflow-hidden rounded-xl border border-border bg-background">
              <ThumbImage scanId={scanId} relPath={img.rel_path} faceCluster={img.primary_face_cluster} rounded="rounded-xl" />
            </div>
            <div className="flex flex-col justify-center rounded-xl border border-border bg-background/50 p-4 text-center">
              <span className="font-mono text-4xl tabular-nums text-accent-teal/90">{img.score.toFixed(3)}</span>
              <span className="mt-1 text-xs uppercase tracking-wider text-muted">Composite training score</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatBlock
              title="Resolution"
              rows={[
                ["Dimensions", `${img.width}×${img.height}`],
                ["Short side", String(Math.min(img.width, img.height))],
              ]}
            />
            <StatBlock
              title="Quality signals"
              rows={[
                ["Sharpness (Laplacian var.)", img.sharpness.toFixed(1)],
                ["Artifact score", img.artifact_score.toFixed(4)],
                ["pHash", img.phash],
              ]}
            />
            {(img.group_size > 1 || img.is_duplicate) && (
              <StatBlock
                title="Near-duplicate cluster"
                rows={[
                  ["Group", `g${img.similar_group}`],
                  ["Members", String(img.group_size)],
                  ["Representative", img.is_representative ? "yes" : "no"],
                  ...(img.duplicate_of ? ([["Duplicate of", img.duplicate_of]] as [string, string][]) : []),
                ]}
              />
            )}
            {img.faces.length > 0 && (
              <StatBlock
                title="Faces"
                rows={[
                  ["Count", String(img.face_count)],
                  ["Primary identity", img.primary_face_cluster ?? "—"],
                ]}
              />
            )}
          </div>

          {img.faces.length > 0 && (
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Detected faces</h3>
              <div className="flex flex-wrap gap-2">
                {img.faces.map((f, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                      f.primary ? "border-accent-teal/50 bg-accent-teal/10" : "border-border bg-background"
                    }`}
                  >
                    <span className="font-mono text-foreground">{f.cluster_id ?? "unclustered"}</span>
                    <span className="ml-2 text-muted">det {f.det_score.toFixed(2)}</span>
                    {f.primary && <span className="ml-2 text-accent-teal">primary</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(img.score_breakdown ?? {}).length > 0 && (
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Score breakdown</h3>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/85">
                {formatScoreBreakdown(img)}
              </pre>
            </div>
          )}

          <div className="rounded-xl border border-accent-teal/30 bg-accent-teal/5 p-4">
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent-teal">Host path</h3>
            <code className="break-all font-mono text-xs text-foreground/90">{img.abs_path}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{title}</h3>
      <dl className="space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-xs">
            <dt className="shrink-0 text-muted">{k}</dt>
            <dd className="break-all text-right font-mono text-foreground/90">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
