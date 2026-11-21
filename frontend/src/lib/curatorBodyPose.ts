/**
 * Body-pose coverage of a selection, for the "Selection coverage" panel on /curate.
 *
 * Curator records argus-puppet's labels and a scan-level pose cluster per row (argus-curator#221,
 * `docs/body-pose.md` there). Clusters span the whole scan; curator computes nothing per selection, so the
 * selection's share in one pose is counted here: its rows by `pose_cluster`, null clusters left out (as puppet
 * leaves unusable poses out of its own count), and the most common cluster's share of the rest.
 */

import {
  BODY_ARMS,
  BODY_FACINGS,
  BODY_STANCES,
  type BodyPoseLabels,
  type PoseCheck,
  type PosedImageResult,
  type PosedScanSummary,
} from "@/components/curator/types";

/*
 * When one pose dominates the selection. Uncalibrated on real sets: 0.75 is argus-puppet's and argus-proof's
 * collapse cut-off, 0.4 an early warning below it, and under 10 clustered rows a share says too little to warn on.
 */
export const POSE_DOMINANCE_WARN = 0.4;
export const POSE_DOMINANCE_STRONG = 0.75;
export const POSE_DOMINANCE_MIN_ROWS = 10;

export interface PoseBucket {
  key: string;
  label: string;
  count: number;
  /** `unknown`: the joints the rule needs were not confident. Its own bucket, never merged into a label. */
  muted: boolean;
}

export interface TopPoseCluster {
  id: number;
  /** Selection rows in this cluster. */
  count: number;
  /** `count` over the selection's clustered rows. */
  share: number;
  medoidRelPath: string | null;
}

export type PoseDominance = "none" | "warn" | "strong";

export interface BodyPoseCoverage {
  stance: PoseBucket[];
  arms: PoseBucket[];
  facing: PoseBucket[];
  /** Selection rows without a usable pose (`pose_check` other than `ok`), by reason. */
  notMeasured: { total: number; unusable: number; noPerson: number; failed: number; unchecked: number };
  /** Selection rows with a cluster id. */
  clustered: number;
  /** Null when the scan has no clusters or no selected row is in one. */
  top: TopPoseCluster | null;
  dominance: PoseDominance;
  stale: boolean;
  skipped: string | null;
}

const NAMES: Record<string, string> = {
  standing: "Standing",
  jumping: "Jumping",
  crouching: "Crouching",
  seated: "Seated",
  lying: "Lying",
  up: "Up",
  out: "Out",
  down: "Down",
  mixed: "Mixed",
  front: "Front",
  back: "Back",
  left: "Left",
  right: "Right",
  unknown: "Unknown",
};

/** The stage ran on this scan and checked at least one row. Without it the panel shows no body-pose block. */
export function hasPoseData(summary: PosedScanSummary): boolean {
  const ran = summary.pose != null || summary.pose_config?.enabled === true;
  return ran && (summary.results as PosedImageResult[]).some((r) => r.pose_check != null);
}

function buckets(rows: readonly PosedImageResult[], axis: keyof BodyPoseLabels, order: readonly string[]): PoseBucket[] {
  const counts = new Map<string, number>(order.map((k) => [k, 0]));
  for (const r of rows) {
    const value = r.pose_labels?.[axis];
    // No labels: pose_check says why, in the not-measured line. Never a bucket of its own.
    if (value == null) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  // A value a newer puppet adds still gets its own bucket, after the known ones, with unknown kept last.
  const keys = [...counts.keys()].sort((a, b) => rank(a, order) - rank(b, order));
  return keys.map((key) => ({ key, label: NAMES[key] ?? key, count: counts.get(key) ?? 0, muted: key === "unknown" }));
}

function rank(key: string, order: readonly string[]): number {
  if (key === "unknown") return Number.MAX_SAFE_INTEGER;
  const i = order.indexOf(key);
  return i === -1 ? order.length : i;
}

/** The selection's largest scan-level cluster, null clusters left out. Ties go to the lower id (the larger scan cluster). */
export function topPoseCluster(summary: PosedScanSummary, rows: readonly PosedImageResult[]): TopPoseCluster | null {
  const clusters = summary.pose?.clusters ?? [];
  if (clusters.length === 0) return null;
  const counts = new Map<number, number>();
  let clustered = 0;
  for (const r of rows) {
    if (r.pose_cluster == null) continue;
    counts.set(r.pose_cluster, (counts.get(r.pose_cluster) ?? 0) + 1);
    clustered += 1;
  }
  let best: [number, number] | null = null;
  for (const [id, count] of counts) {
    if (best == null || count > best[1] || (count === best[1] && id < best[0])) best = [id, count];
  }
  if (best == null) return null;
  const [id, count] = best;
  const medoid = clusters.find((c) => c.id === id)?.medoid_rel_path ?? null;
  return { id, count, share: count / clustered, medoidRelPath: medoid };
}

export function poseDominance(share: number, clustered: number): PoseDominance {
  if (clustered < POSE_DOMINANCE_MIN_ROWS) return "none";
  if (share >= POSE_DOMINANCE_STRONG) return "strong";
  if (share >= POSE_DOMINANCE_WARN) return "warn";
  return "none";
}

/** Null when the scan has no pose data ({@link hasPoseData}), so the block is left out. */
export function bodyPoseCoverage(summary: PosedScanSummary, rows: readonly PosedImageResult[]): BodyPoseCoverage | null {
  if (!hasPoseData(summary)) return null;
  const notMeasured = { total: 0, unusable: 0, noPerson: 0, failed: 0, unchecked: 0 };
  const reasons: Record<Exclude<PoseCheck, "ok">, keyof typeof notMeasured> = {
    unusable: "unusable",
    no_person: "noPerson",
    failed: "failed",
  };
  for (const r of rows) {
    if (r.pose_check === "ok") continue;
    notMeasured.total += 1;
    notMeasured[r.pose_check == null ? "unchecked" : reasons[r.pose_check]] += 1;
  }
  const clustered = rows.filter((r) => r.pose_cluster != null).length;
  const top = topPoseCluster(summary, rows);
  return {
    stance: buckets(rows, "stance", BODY_STANCES),
    arms: buckets(rows, "arms", BODY_ARMS),
    facing: buckets(rows, "facing", BODY_FACINGS),
    notMeasured,
    clustered,
    top,
    dominance: top ? poseDominance(top.share, clustered) : "none",
    stale: summary.pose?.stale === true,
    skipped: summary.pose?.skipped ?? null,
  };
}

/** "12 of 60 not measured: 9 unusable, 3 no person", or null when every row has a usable pose. */
export function notMeasuredLine(c: BodyPoseCoverage, n: number): string | null {
  const m = c.notMeasured;
  if (m.total === 0) return null;
  const parts = (
    [
      [m.unusable, "unusable"],
      [m.noPerson, "no person"],
      [m.failed, "failed"],
      [m.unchecked, "not checked"],
    ] as const
  )
    .filter(([count]) => count > 0)
    .map(([count, what]) => `${count} ${what}`);
  return `${m.total} of ${n} not measured: ${parts.join(", ")}`;
}

/** The coverage-gap entry when one pose dominates, or null. */
export function poseDominanceGap(c: BodyPoseCoverage): { text: string; strong: boolean } | null {
  if (!c.top || c.dominance === "none") return null;
  const pct = Math.round(c.top.share * 100);
  const of = `${c.top.count} of ${c.clustered} clustered`;
  return c.dominance === "strong"
    ? { text: `Pose collapse: ${pct}% share one body pose (${of}). Add other stances and arm positions`, strong: true }
    : { text: `${pct}% share one body pose (${of})`, strong: false };
}
