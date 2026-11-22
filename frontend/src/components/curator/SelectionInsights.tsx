"use client";

import { useMemo } from "react";
import {
  bodyPoseCoverage,
  notMeasuredLine,
  poseDominanceGap,
  type BodyPoseCoverage,
} from "@/lib/curatorBodyPose";
import { scanCheckedNsfw, thumbSafety } from "@/lib/curatorSafety";
import { ThumbImage } from "./ThumbImage";
import {
  POSE_LABELS,
  suggestTrainingParams,
  type FacePose,
  type ImageResult,
  type ScanSummary,
} from "./types";

interface Props {
  summary: ScanSummary;
  selectedResults: ImageResult[];
  /** Checks still running on this scan, for the medoid thumbnail's blur. */
  pending?: readonly string[];
}

interface Bucket {
  key: string;
  label: string;
  count: number;
  /** A reading that is not a label (`unknown`): shown muted. */
  muted?: boolean;
}

interface Gap {
  text: string;
  strong?: boolean;
}

/** Primary-face bbox area as a fraction of the frame, or null if no primary face. */
function primaryFaceArea(img: ImageResult): number | null {
  const primary = img.faces.find((f) => f.primary) ?? img.faces[0];
  if (!primary) return null;
  const [, , w, h] = primary.bbox;
  const frame = img.width * img.height;
  if (frame <= 0) return null;
  return Math.min(1, (w * h) / frame);
}

export function SelectionInsights({ summary, selectedResults, pending = [] }: Props) {
  const hasFaces = summary.faces_config.enabled;
  const n = selectedResults.length;

  const insights = useMemo(() => {
    // Angle coverage (needs face poses).
    const poseOrder: FacePose[] = ["frontal", "three_quarter", "profile"];
    const poseCounts: Record<string, number> = { frontal: 0, three_quarter: 0, profile: 0 };
    let noPose = 0;
    for (const r of selectedResults) {
      if (r.primary_face_pose) poseCounts[r.primary_face_pose] += 1;
      else noPose += 1;
    }
    const angle: Bucket[] = poseOrder.map((p) => ({ key: p, label: POSE_LABELS[p], count: poseCounts[p] }));

    // Framing via aspect ratio.
    let portrait = 0;
    let square = 0;
    let landscape = 0;
    for (const r of selectedResults) {
      const ar = r.width / Math.max(1, r.height);
      if (ar < 0.9) portrait += 1;
      else if (ar > 1.1) landscape += 1;
      else square += 1;
    }
    const framing: Bucket[] = [
      { key: "portrait", label: "Portrait", count: portrait },
      { key: "square", label: "Square", count: square },
      { key: "landscape", label: "Landscape", count: landscape },
    ];

    // Shot scale via primary-face area (close-up vs full-body).
    let closeUp = 0;
    let medium = 0;
    let wide = 0;
    for (const r of selectedResults) {
      const area = primaryFaceArea(r);
      // No detected face — shot scale is unknown, so it lands in no bucket.
      if (area == null) continue;
      else if (area >= 0.12) closeUp += 1;
      else if (area >= 0.03) medium += 1;
      else wide += 1;
    }
    const shotScale: Bucket[] = [
      { key: "close", label: "Close-up", count: closeUp },
      { key: "medium", label: "Half-body", count: medium },
      { key: "wide", label: "Full / wide", count: wide },
    ];

    // Face composition.
    let single = 0;
    let multi = 0;
    let none = 0;
    for (const r of selectedResults) {
      if (r.face_count === 1) single += 1;
      else if (r.face_count >= 2) multi += 1;
      else none += 1;
    }
    const faceComp: Bucket[] = [
      { key: "single", label: "Single face", count: single },
      { key: "multi", label: "Multiple faces", count: multi },
      { key: "none", label: "No face", count: none },
    ];

    // Identity balance (per cluster).
    const idCounts = new Map<string, number>();
    for (const r of selectedResults) {
      const id = r.primary_face_cluster ?? "—";
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    }
    const identity: Bucket[] = [...idCounts.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count);

    // Variety: distinct near-duplicate groups vs raw count.
    const groups = new Set(selectedResults.map((r) => r.similar_group));
    const uniqueGroups = groups.size;

    // Gaps worth flagging.
    // Body pose (argus-puppet, through curator): absent unless the stage ran on this scan.
    const body = bodyPoseCoverage(summary, selectedResults);

    const gaps: Gap[] = [];
    const gap = (text: string) => gaps.push({ text });
    if (hasFaces) {
      for (const p of poseOrder) if (poseCounts[p] === 0) gap(`No ${POSE_LABELS[p].toLowerCase()} shots`);
      if (none > 0) gap(`${none} faceless image${none > 1 ? "s" : ""} — weak signal for identity`);
      if (noPose > 0 && none === 0) gap(`${noPose} without a scored pose`);
    }
    const bodyGap = body ? poseDominanceGap(body) : null;
    if (bodyGap) gaps.push(bodyGap);
    if (uniqueGroups < n) gap(`${n - uniqueGroups} near-duplicate${n - uniqueGroups > 1 ? "s" : ""} in the set`);

    return { angle, framing, shotScale, faceComp, identity, uniqueGroups, gaps, noPose, body };
  }, [summary, selectedResults, hasFaces, n]);

  const params = useMemo(
    () => suggestTrainingParams(n, summary.target_profile.target_category),
    [n, summary.target_profile.target_category],
  );

  if (n === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Selection insights</h3>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Select images to see angle/framing coverage and suggested training params for the set.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Selection coverage</h3>
          <span className="text-[11px] text-muted">
            {n} img · {insights.uniqueGroups} unique
          </span>
        </div>

        {hasFaces ? (
          <>
            <Distribution title="Angle (head pose)" buckets={insights.angle} total={n} accent="accent-purple" />
            <Distribution title="Shot scale" buckets={insights.shotScale} total={n} accent="accent-teal" />
            <Distribution title="Face composition" buckets={insights.faceComp} total={n} accent="accent-green" />
            {insights.identity.length > 1 && (
              <Distribution title="Identity balance" buckets={insights.identity} total={n} accent="accent-orange" />
            )}
          </>
        ) : (
          <p className="rounded-lg border border-border bg-background/60 p-2.5 text-[11px] leading-relaxed text-muted">
            Enable <span className="font-mono text-foreground/80">Face Clustering</span> on the scan to get angle,
            shot-scale, and identity coverage. Framing is available now:
          </p>
        )}

        {insights.body && <BodyPoseBlock summary={summary} coverage={insights.body} total={n} pending={pending} />}

        <Distribution title="Framing (aspect)" buckets={insights.framing} total={n} accent="accent-teal" />

        {insights.gaps.length > 0 && (
          <div className="space-y-1 rounded-lg border border-accent-orange/30 bg-accent-orange/5 p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-orange-ink">Coverage gaps</span>
            <ul className="space-y-0.5">
              {insights.gaps.map((g) => (
                <li
                  key={g.text}
                  className={`text-[11px] leading-snug ${g.strong ? "font-semibold text-accent-red-ink" : "text-accent-orange-ink"}`}
                >
                  • {g.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <TrainingParamsCard params={params} />
    </div>
  );
}

const ACCENT_BAR: Record<string, string> = {
  "accent-purple": "bg-accent-purple/70",
  "accent-teal": "bg-accent-teal/70",
  "accent-green": "bg-accent-green/70",
  "accent-orange": "bg-accent-orange/70",
};

function Distribution({
  title,
  buckets,
  total,
  accent,
}: {
  title: string;
  buckets: Bucket[];
  total: number;
  accent: string;
}) {
  const bar = ACCENT_BAR[accent] ?? "bg-accent-teal/70";
  return (
    <div>
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted">{title}</span>
      <div className="space-y-1.5">
        {buckets.map((b) => {
          const pct = total > 0 ? (b.count / total) * 100 : 0;
          return (
            <div key={b.key} className="flex items-center gap-2">
              <span
                className={`w-24 shrink-0 truncate text-[11px] ${b.muted ? "italic text-muted" : "text-foreground/80"}`}
                title={b.label}
              >
                {b.label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
                <div
                  className={`h-full rounded-full ${b.count === 0 ? "bg-transparent" : b.muted ? "bg-muted/40" : bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-[11px] text-muted tabular-nums">{b.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Body pose from argus-puppet: the selection's stance, arms and facing, and how much of it sits in one scan-level
 * pose cluster. Rows with no labels land in no bucket; the not-measured line says why.
 */
function BodyPoseBlock({
  summary,
  coverage,
  total,
  pending,
}: {
  summary: ScanSummary;
  coverage: BodyPoseCoverage;
  total: number;
  pending: readonly string[];
}) {
  const { top } = coverage;
  const notMeasured = notMeasuredLine(coverage, total);
  const medoid = top?.medoidRelPath ? summary.results.find((r) => r.rel_path === top.medoidRelPath) : undefined;
  // A medoid this page does not hold has not been checked, so it stays blurred (as the identity tiles do).
  const blurred = medoid ? thumbSafety(medoid, scanCheckedNsfw(summary), pending).blurred : true;
  return (
    <div className="space-y-3">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">Body pose</span>
      {top && (
        <div className="flex items-center gap-2">
          {top.medoidRelPath && (
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md" title={blurred ? "Blurred" : top.medoidRelPath}>
              <div className={blurred ? "h-full w-full scale-105 blur-md" : "h-full w-full"}>
                <ThumbImage scanId={summary.scan_id} relPath={top.medoidRelPath} rounded="rounded-md" />
              </div>
            </div>
          )}
          <div className="min-w-0 text-[11px] leading-snug">
            <div className="text-foreground">
              <span className="font-mono tabular-nums">{Math.round(top.share * 100)}%</span> share one pose
            </div>
            <div className="text-muted">
              {top.count} of {coverage.clustered} clustered · pose cluster {top.id}
            </div>
          </div>
        </div>
      )}
      <Distribution title="Stance" buckets={coverage.stance} total={total} accent="accent-purple" />
      <Distribution title="Arms" buckets={coverage.arms} total={total} accent="accent-teal" />
      <Distribution title="Facing" buckets={coverage.facing} total={total} accent="accent-green" />
      {(notMeasured || coverage.stale || coverage.skipped) && (
        <ul className="space-y-0.5 text-[10px] leading-relaxed text-muted">
          {notMeasured && <li>{notMeasured}</li>}
          {coverage.skipped && <li>Pose clusters were not formed: {coverage.skipped}</li>}
          {coverage.stale && <li>
              Images were deleted or moved since the scan was clustered: sizes are recounted, but the clusters may be
              out of date.
            </li>}
        </ul>
      )}
    </div>
  );
}

function TrainingParamsCard({ params }: { params: ReturnType<typeof suggestTrainingParams> }) {
  const rows: [string, string][] = [
    ["Repeats / image", String(params.repeats)],
    ["Epochs", String(params.epochs)],
    ["≈ Total steps", params.totalSteps.toLocaleString()],
    ["Network dim / alpha", `${params.networkDim} / ${params.networkAlpha}`],
    ["UNet LR", params.unetLr],
    ["Text-encoder LR", params.textEncoderLr],
    ["Optimizer", params.optimizer],
    ["LR scheduler", params.scheduler],
    ["Resolution", `${params.resolution}px`],
    ["Batch size", String(params.batchSize)],
    ["Precision", params.precision],
  ];
  return (
    <div className="space-y-3 rounded-xl border border-accent-purple/30 bg-accent-purple/5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-accent-purple-ink">Suggested training</h3>
        <span className="text-[11px] text-muted">SDXL LoRA · {params.images} img</span>
      </div>
      <dl className="grid grid-cols-1 gap-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-xs">
            <dt className="shrink-0 text-muted">{k}</dt>
            <dd className="text-right font-mono text-foreground/90">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[10px] leading-relaxed text-muted">
        Starting points for a kohya-style SDXL LoRA. Repeats/epochs target ~{params.totalSteps.toLocaleString()} steps
        for this set size; watch samples and stop early if it overfits.
      </p>
    </div>
  );
}
