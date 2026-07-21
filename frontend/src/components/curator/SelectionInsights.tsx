"use client";

import { useMemo } from "react";
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
}

interface Bucket {
  key: string;
  label: string;
  count: number;
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

export function SelectionInsights({ summary, selectedResults }: Props) {
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
    const gaps: string[] = [];
    if (hasFaces) {
      for (const p of poseOrder) if (poseCounts[p] === 0) gaps.push(`No ${POSE_LABELS[p].toLowerCase()} shots`);
      if (none > 0) gaps.push(`${none} faceless image${none > 1 ? "s" : ""} — weak signal for identity`);
      if (noPose > 0 && none === 0) gaps.push(`${noPose} without a scored pose`);
    }
    if (uniqueGroups < n) gaps.push(`${n - uniqueGroups} near-duplicate${n - uniqueGroups > 1 ? "s" : ""} in the set`);

    return { angle, framing, shotScale, faceComp, identity, uniqueGroups, gaps, noPose };
  }, [selectedResults, hasFaces, n]);

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

        <Distribution title="Framing (aspect)" buckets={insights.framing} total={n} accent="accent-teal" />

        {insights.gaps.length > 0 && (
          <div className="space-y-1 rounded-lg border border-accent-orange/30 bg-accent-orange/5 p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-orange">Coverage gaps</span>
            <ul className="space-y-0.5">
              {insights.gaps.map((g) => (
                <li key={g} className="text-[11px] leading-snug text-accent-orange/90">
                  • {g}
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
              <span className="w-24 shrink-0 truncate text-[11px] text-foreground/80" title={b.label}>
                {b.label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
                <div className={`h-full rounded-full ${b.count === 0 ? "bg-transparent" : bar}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-[11px] text-muted tabular-nums">{b.count}</span>
            </div>
          );
        })}
      </div>
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
        <h3 className="text-xs font-semibold uppercase tracking-wider text-accent-purple">Suggested training</h3>
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
