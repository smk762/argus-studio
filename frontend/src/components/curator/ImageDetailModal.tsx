"use client";

import { useCallback, useEffect } from "react";
import { ThumbImage } from "./ThumbImage";
import { breakdownTooltip, statusExplanation } from "./imageExplain";
import { POSE_LABELS, type ImageResult } from "./types";

interface Props {
  scanId: string;
  img: ImageResult | null;
  /** The filtered gallery the modal navigates within (prev/next). */
  list: ImageResult[];
  selected: boolean;
  onToggle: (relPath: string) => void;
  onNavigate: (img: ImageResult) => void;
  onClose: () => void;
}

export function ImageDetailModal({ scanId, img, list, selected, onToggle, onNavigate, onClose }: Props) {
  const idx = img ? list.findIndex((r) => r.rel_path === img.rel_path) : -1;
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

  const goPrev = useCallback(() => prev && onNavigate(prev), [prev, onNavigate]);
  const goNext = useCallback(() => next && onNavigate(next), [next, onNavigate]);

  useEffect(() => {
    if (!img) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [img, onClose, goPrev, goNext]);

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
        className="scrollbar-thin max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2 id="curator-detail-title" className="truncate text-sm font-semibold text-foreground">
              {img.rel_path}
            </h2>
            <p className="mt-0.5 text-xs text-muted">{statusExplanation(img)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {idx >= 0 && (
              <div className="mr-1 flex items-center gap-1">
                <NavButton label="Previous image (←)" disabled={!prev} onClick={goPrev}>
                  ‹
                </NavButton>
                <span className="min-w-[3.5rem] text-center font-mono text-xs text-muted tabular-nums">
                  {idx + 1} / {list.length}
                </span>
                <NavButton label="Next image (→)" disabled={!next} onClick={goNext}>
                  ›
                </NavButton>
              </div>
            )}
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

        <div className="p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Image takes two of the three columns. */}
            <div className="lg:col-span-2">
              <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-xl border border-border bg-background">
                <ThumbImage
                  scanId={scanId}
                  relPath={img.rel_path}
                  faceCluster={img.primary_face_cluster}
                  rounded="rounded-xl"
                  fit="contain"
                />
              </div>
            </div>

            {/* Everything else stacks in the last column. */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Composite score
                  </span>
                  <span className="font-mono text-2xl tabular-nums text-accent-teal/90">{img.score.toFixed(3)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-hover">
                  <div className="h-full rounded-full bg-accent-teal" style={{ width: `${Math.round(img.score * 100)}%` }} />
                </div>
              </div>

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
                    [
                      "Primary orientation",
                      img.primary_face_pose
                        ? `${POSE_LABELS[img.primary_face_pose]}${
                            img.primary_face_yaw != null ? ` (yaw ${img.primary_face_yaw.toFixed(0)}°)` : ""
                          }`
                        : "—",
                    ],
                  ]}
                />
              )}

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
                        {f.pose && <span className="ml-2 text-accent-purple">{POSE_LABELS[f.pose]}</span>}
                        {f.primary && <span className="ml-2 text-accent-teal">primary</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <ScoreBreakdown img={img} />

              <div className="rounded-xl border border-accent-teal/30 bg-accent-teal/5 p-4">
                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent-teal">Host path</h3>
                <code className="break-all font-mono text-xs text-foreground/90">{img.abs_path}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border text-lg leading-none text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

const BREAKDOWN_LABELS: Record<string, string> = {
  sharpness: "Sharpness",
  resolution: "Resolution",
  artifact: "Artifact (cleanliness)",
  target_bonus: "Target-fit bonus",
  face_penalty: "Face penalty",
};

function prettyKey(key: string): string {
  return BREAKDOWN_LABELS[key] ?? key.replace(/_/g, " ");
}

/** Score breakdown with per-component tooltips and additive-share proportion bars. */
function ScoreBreakdown({ img }: { img: ImageResult }) {
  const entries = Object.entries(img.score_breakdown ?? {});
  if (entries.length === 0) return null;

  const additive = entries.filter(([k]) => k !== "face_penalty") as [string, number][];
  const penalty = entries.find(([k]) => k === "face_penalty") as [string, number] | undefined;
  const sum = additive.reduce((a, [, v]) => a + (typeof v === "number" ? v : 0), 0);

  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Score breakdown</h3>
      <div className="space-y-2.5">
        {additive.map(([k, v]) => {
          const val = typeof v === "number" ? v : 0;
          const pct = sum > 0 ? (val / sum) * 100 : 0;
          return (
            <div key={k} className="cursor-help" title={breakdownTooltip(k)}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-foreground/85">{prettyKey(k)}</span>
                <span className="shrink-0 font-mono text-foreground/70 tabular-nums">
                  {val.toFixed(3)} · {pct.toFixed(0)}%
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-hover">
                <div className="h-full rounded-full bg-accent-teal/70" style={{ width: `${Math.max(0, pct)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {penalty && (
        <div
          className="mt-3 flex cursor-help items-baseline justify-between border-t border-border pt-2.5 text-xs"
          title={breakdownTooltip("face_penalty")}
        >
          <span className="text-accent-orange/90">{prettyKey("face_penalty")}</span>
          <span className="font-mono text-accent-orange/90 tabular-nums">×{Number(penalty[1]).toFixed(2)}</span>
        </div>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-muted">
        Bars show each part&apos;s share of the additive score
        {penalty ? "; the face penalty then multiplies the total." : "."} Hover a row for what it measures.
      </p>
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
