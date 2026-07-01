"use client";

import { ThumbImage } from "./ThumbImage";
import { statusExplanation } from "./imageExplain";
import { faceFocalPoint, POSE_LABELS, type ImageResult } from "./types";

interface Props {
  scanId: string;
  results: ImageResult[];
  selected: Set<string>;
  onToggle: (relPath: string) => void;
  onOpen: (img: ImageResult) => void;
}

export function ResultsGrid({ scanId, results, selected, onToggle, onOpen }: Props) {
  if (results.length === 0) {
    return <div className="py-10 text-center text-sm text-muted">No images match the current facets.</div>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {results.map((img) => (
        <Card
          key={img.rel_path}
          scanId={scanId}
          img={img}
          selected={selected.has(img.rel_path)}
          onToggle={() => onToggle(img.rel_path)}
          onOpen={() => onOpen(img)}
        />
      ))}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 0.7
      ? "bg-accent-green/20 text-accent-green"
      : score >= 0.4
        ? "bg-accent-amber/20 text-accent-amber"
        : "bg-accent-red/20 text-accent-red";
  return <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${color}`}>{score.toFixed(2)}</span>;
}

function Card({
  scanId,
  img,
  selected,
  onToggle,
  onOpen,
}: {
  scanId: string;
  img: ImageResult;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const border = selected
    ? "border-accent-green/70 ring-2 ring-accent-green/40"
    : !img.passed
      ? "border-accent-red/35"
      : img.is_duplicate
        ? "border-accent-amber/50"
        : "border-border";

  const fade = img.passed ? "opacity-100" : "opacity-60 saturate-75";

  const status = !img.passed
    ? { label: "Rejected", cls: "bg-accent-red/20 text-accent-red" }
    : img.is_duplicate
      ? { label: "Duplicate", cls: "bg-accent-amber/20 text-accent-amber" }
      : { label: "Passed", cls: "bg-accent-green/15 text-accent-green" };

  // Unique face clusters present on this image.
  const clusters = Array.from(
    new Set(img.faces.map((f) => f.cluster_id).filter((c): c is string => Boolean(c))),
  );

  return (
    <div className={`group relative overflow-hidden rounded-lg border bg-surface transition-all ${border} ${fade}`}>
      {/* Selection checkbox */}
      <button
        type="button"
        onClick={onToggle}
        title={selected ? "Deselect" : "Select for export"}
        className={`absolute left-1.5 top-1.5 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded border text-[11px] font-bold transition-colors ${
          selected
            ? "border-accent-green bg-accent-green text-black"
            : "border-white/40 bg-black/40 text-transparent hover:border-accent-green/70"
        }`}
      >
        ✓
      </button>

      <button
        type="button"
        onClick={onOpen}
        title={`${img.rel_path}\n\n${statusExplanation(img)}`}
        className="block w-full cursor-pointer text-left"
      >
        <div className="relative aspect-square">
          <ThumbImage
            scanId={scanId}
            relPath={img.rel_path}
            faceCluster={img.primary_face_cluster}
            objectPosition={faceFocalPoint(img)}
          />
          <div className="absolute right-1 top-1">
            <ScoreBadge score={img.score} />
          </div>
          {img.group_size > 1 && (
            <span
              className="absolute bottom-1 left-1 rounded bg-accent-amber/20 px-1.5 py-0.5 font-mono text-[10px] text-accent-amber"
              title={`Near-duplicate cluster g${img.similar_group} (${img.group_size} images)`}
            >
              g{img.similar_group}
              {img.is_representative ? "*" : ""}
            </span>
          )}
          {img.face_count > 0 && (
            <div className="absolute bottom-1 right-1 flex flex-wrap justify-end gap-0.5">
              {clusters.slice(0, 2).map((c) => (
                <span key={c} className="rounded bg-accent-teal/20 px-1 py-0.5 font-mono text-[9px] text-accent-teal">
                  {c}
                </span>
              ))}
              {img.face_count > 1 && clusters.length <= 1 && (
                <span className="rounded bg-accent-pink/20 px-1 py-0.5 font-mono text-[9px] text-accent-pink">
                  {img.face_count} faces
                </span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1 p-2">
          <div className="truncate font-mono text-[10px] text-muted" title={img.rel_path}>
            {img.rel_path}
          </div>
          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${status.cls}`}>
            {status.label}
          </span>
          {img.primary_face_pose && (
            <span
              className="ml-1 inline-block rounded bg-accent-purple/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-purple"
              title={
                img.primary_face_yaw != null
                  ? `Primary face orientation (yaw ${img.primary_face_yaw.toFixed(0)}°)`
                  : "Primary face orientation"
              }
            >
              {POSE_LABELS[img.primary_face_pose]}
            </span>
          )}
          {img.reject_reason && (
            <div className="truncate text-[10px] leading-tight text-accent-red/80" title={img.reject_reason}>
              {img.reject_reason}
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
