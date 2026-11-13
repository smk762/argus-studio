"use client";

import { cardAge, checkWarnings } from "@/lib/curatorAttributes";
import { policyShields } from "@/lib/curatorGuard";
import { canExport, exportBlockReason } from "@/lib/curatorSafety";
import { inFirstRow } from "@/lib/imageLoading";
import { imagePending, pendingCaption } from "@/lib/scanChunks";
import { GuardShield } from "./GuardShield";
import { SafeThumb } from "./SafeThumb";
import { statusExplanation } from "./imageExplain";
import { POSE_LABELS, type ImageResult } from "./types";

interface Props {
  scanId: string;
  results: ImageResult[];
  /** The finished scan ran NudeNet, so an unscored row is not "clear". */
  nsfwRan: boolean;
  /** Checks still running. Empty once the scan has finished. */
  pending?: readonly string[];
  /** Policies the scan ran, official first. */
  policies?: readonly string[];
  officialPolicy?: string | null;
  selected: Set<string>;
  onToggle: (relPath: string) => void;
  onOpen: (img: ImageResult) => void;
}

export function ResultsGrid({ scanId, results, nsfwRan, pending = [], policies = [], officialPolicy = null, selected, onToggle, onOpen }: Props) {
  if (results.length === 0) {
    return <div className="py-10 text-center text-sm text-muted">No images match the current facets.</div>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {results.map((img, position) => (
        <Card
          key={img.rel_path}
          eager={inFirstRow(position)}
          scanId={scanId}
          img={img}
          nsfwRan={nsfwRan}
          pending={pending}
          policies={policies}
          officialPolicy={officialPolicy}
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
      ? "text-accent-green"
      : score >= 0.4
        ? "text-accent-amber"
        : "text-accent-red";
  return <span className={`rounded bg-surface/90 px-1.5 py-0.5 font-mono text-[10px] font-bold ${color}`}>{score.toFixed(2)}</span>;
}

function Card({
  scanId,
  img,
  nsfwRan,
  pending,
  policies,
  officialPolicy,
  selected,
  onToggle,
  onOpen,
  eager,
}: {
  eager: boolean;
  scanId: string;
  img: ImageResult;
  nsfwRan: boolean;
  pending: readonly string[];
  policies: readonly string[];
  officialPolicy: string | null;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const exportable = canExport(img);
  const blocked = exportBlockReason(img);
  const waiting = imagePending(img, pending);
  const age = cardAge(img);
  const warnings = checkWarnings(img);
  const shields = policyShields(img, policies, officialPolicy, pending.includes("guard"));
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
        disabled={!exportable}
        title={exportable ? (selected ? "Deselect" : "Select for export") : (blocked ?? "Not exported")}
        className={`absolute left-1.5 top-1.5 z-30 flex h-5 w-5 items-center justify-center rounded border text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          exportable ? "cursor-pointer" : ""
        } ${
          selected
            ? "border-accent-green bg-accent-green text-on-accent"
            : "border-white/40 bg-black/40 text-transparent hover:border-accent-green/70"
        }`}
      >
        ✓
      </button>

      <div className="relative aspect-square" title={`${img.rel_path}\n\n${statusExplanation(img)}`}>
        <SafeThumb scanId={scanId} img={img} nsfwRan={nsfwRan} pending={pending} onActivate={onOpen} eager={eager} />
        <div className="pointer-events-none absolute right-1 top-1 z-10">
          <ScoreBadge score={img.score} />
        </div>
        {img.group_size > 1 && (
          <span
            className="pointer-events-none absolute bottom-1 left-1 z-10 rounded bg-surface/90 px-1.5 py-0.5 font-mono text-[10px] text-accent-amber"
            title={`Near-duplicate cluster g${img.similar_group} (${img.group_size} images)`}
          >
            g{img.similar_group}
            {img.is_representative ? "*" : ""}
          </span>
        )}
        {img.face_count > 0 && (
          <div className="pointer-events-none absolute bottom-1 right-1 z-10 flex flex-wrap justify-end gap-0.5">
            {clusters.slice(0, 2).map((c) => (
              <span key={c} className="rounded bg-surface/90 px-1 py-0.5 font-mono text-[9px] text-accent-teal">
                {c}
              </span>
            ))}
            {img.face_count > 1 && clusters.length <= 1 && (
              <span className="rounded bg-surface/90 px-1 py-0.5 font-mono text-[9px] text-accent-pink">
                {img.face_count} faces
              </span>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onOpen}
        title={`${img.rel_path}\n\n${statusExplanation(img)}`}
        className="block w-full cursor-pointer text-left"
      >
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
          {age && (
            <span
              className="ml-1 inline-block rounded bg-accent-purple/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-purple"
              title="A model's estimate"
            >
              {age}
            </span>
          )}
          {warnings.length > 0 && (
            <span
              className="ml-1 inline-block rounded bg-accent-orange/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-orange"
              title={warnings.join(" ")}
            >
              Unchecked
            </span>
          )}
          {img.crop && (
            <span
              className="ml-1 inline-block rounded bg-accent-teal/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-teal"
              title={img.crop_source === "detected" ? "Cropped: watermark at the edge" : "Cropped by a box by hand"}
            >
              Cropped
            </span>
          )}
          {shields.length > 0 && (
            <span className="ml-1 inline-flex items-center gap-0.5 align-middle">
              {shields.map((shield) => (
                <GuardShield key={shield.policy} shield={shield} />
              ))}
            </span>
          )}
          {waiting.length > 0 && (
            <div className="truncate text-[10px] leading-tight text-accent-teal" title={`Still checking ${pendingCaption(waiting)}`}>
              Checking {pendingCaption(waiting)}
            </div>
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
