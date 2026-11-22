/**
 * How /proof reads a report's body-pose block (argus-proof#122, proof 0.5.3; argus-studio#281).
 *
 * Proof scores pose through argus-puppet and its acceptance check decides with it; Studio only shows what the
 * report measured. The constants below are copies of argus-proof's `acceptance.py` (at the pinned commit), so the
 * panel calls a block unmeasurable, a collapse or copying evidence exactly when proof's own gate would. They are
 * calibrated on synthetic poses only, as proof says. Copying evidence is never a reject: a pose-conditioned
 * generator reproduces training poses by design.
 */

import type * as Wire from "@/lib/generated/proof";

export const POSE_MIN_USABLE = 10;
export const POSE_MIN_USABLE_SHARE = 0.5;
export const POSE_MIN_COMPARABLE_SHARE = 0.8;
/** Proof's default `max_pose_cluster_share`: a largest cluster at or above it is a collapse. */
export const POSE_MAX_CLUSTER_SHARE = 0.75;
export const POSE_COPYING_MIN_EXCESS = 0.1;
export const POSE_COPYING_MIN_ELIGIBLE = 20;

export type PoseReading =
  | { state: "absent" }
  | { state: "unmeasurable"; why: string; pose: Wire.PoseReport }
  | {
      state: "measured";
      pose: Wire.PoseReport;
      diversity: number;
      largestShare: number;
      /** The largest cluster is at or above proof's default cut-off. */
      collapsed: boolean;
      /** Outputs sit closer to training poses than the training frames do to each other (review evidence). */
      copying: boolean;
    };

/** Why the block can't be read, as proof's `pose_unmeasurable` words it, or null when it can. */
export function poseUnmeasurable(pose: Wire.PoseReport): string | null {
  if (pose.usable == null) {
    return `pose not measured: ${pose.provenance?.not_checked?.[0] ?? "puppet returned no set stats"}`;
  }
  if (pose.usable < POSE_MIN_USABLE) return `${pose.usable} usable pose(s), need at least ${POSE_MIN_USABLE}`;
  if (pose.count === 0 || pose.usable / pose.count < POSE_MIN_USABLE_SHARE) {
    return `${pose.usable}/${pose.count} images have a usable pose, need at least ${POSE_MIN_USABLE_SHARE * 100}%`;
  }
  if (pose.comparable_share == null || pose.comparable_share < POSE_MIN_COMPARABLE_SHARE) {
    const share = pose.comparable_share == null ? "unknown" : pose.comparable_share.toFixed(2);
    return `comparable pose share ${share}, need at least ${POSE_MIN_COMPARABLE_SHARE.toFixed(2)}`;
  }
  if (pose.diversity == null || pose.largest_cluster_share == null) return "pose diversity not measured";
  return null;
}

/** Proof's copying flag: enough eligible outputs, and an excess over the training set's own baseline. */
export function poseCopying(comparison: Wire.PoseComparison | null | undefined): boolean {
  if (!comparison || comparison.close_excess == null) return false;
  return comparison.close_eligible >= POSE_COPYING_MIN_ELIGIBLE && comparison.close_excess >= POSE_COPYING_MIN_EXCESS;
}

export function readPose(pose: Wire.PoseReport | null | undefined): PoseReading {
  if (!pose) return { state: "absent" };
  const why = poseUnmeasurable(pose);
  if (why !== null || pose.diversity == null || pose.largest_cluster_share == null) {
    return { state: "unmeasurable", why: why ?? "pose diversity not measured", pose };
  }
  return {
    state: "measured",
    pose,
    diversity: pose.diversity,
    largestShare: pose.largest_cluster_share,
    collapsed: pose.largest_cluster_share >= POSE_MAX_CLUSTER_SHARE,
    copying: poseCopying(pose.comparison),
  };
}

/** One coverage axis as [label, count] pairs, most common first, `unknown` last (a real reading, kept separate). */
export function coverageAxis(counts: Record<string, number> | undefined): [string, number][] {
  return Object.entries(counts ?? {})
    .filter(([, n]) => n > 0)
    .sort(([a, x], [b, y]) => (a === "unknown" ? 1 : b === "unknown" ? -1 : y - x || a.localeCompare(b)));
}
