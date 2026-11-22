import { describe, expect, it } from "vitest";
import type * as Wire from "@/lib/generated/proof";
import { coverageAxis, poseCopying, readPose } from "@/lib/proofPose";

const pose = (extra: Partial<Wire.PoseReport> = {}): Wire.PoseReport => ({
  count: 40,
  posed: 40,
  partial: false,
  failed_images: [],
  usable: 36,
  comparable_share: 0.95,
  diversity: 0.62,
  mean_pairwise_distance: 0.3,
  cluster_count: 7,
  largest_cluster_share: 0.3,
  largest_cluster_medoids: ["out-00003"],
  coverage: null,
  comparison: null,
  provenance: { detector_model: null, not_checked: [], package_version: null, params: {}, pose_model: null, puppet_version: "1.3", training: null },
  ...extra,
});

const comparison = (extra: Partial<Wire.PoseComparison> = {}): Wire.PoseComparison => ({
  training_frames: 30,
  output_count: 40,
  matched_count: 36,
  reference_count: 28,
  close_eligible: 30,
  close_share: 0.4,
  baseline_eligible: 28,
  baseline_close_share: 0.2,
  close_excess: 0.2,
  output_nn_distance: null,
  reference_nn_distance: null,
  coverage_divergence: null,
  reference_coverage: null,
  training_diversity: 0.7,
  training_largest_cluster_share: 0.2,
  threshold: 0.1,
  n_close: 12,
  close_pairs: [],
  ...extra,
});

describe("readPose", () => {
  it("is absent without a block (an older proof, or no puppet when scored)", () => {
    expect(readPose(undefined).state).toBe("absent");
    expect(readPose(null).state).toBe("absent");
  });

  it("reads a measurable block", () => {
    const r = readPose(pose());
    expect(r).toMatchObject({ state: "measured", diversity: 0.62, largestShare: 0.3, collapsed: false, copying: false });
  });

  it("calls a largest cluster at proof's default cut-off a collapse", () => {
    expect(readPose(pose({ largest_cluster_share: 0.75 }))).toMatchObject({ collapsed: true });
    expect(readPose(pose({ largest_cluster_share: 0.74 }))).toMatchObject({ collapsed: false });
  });

  it("says why a block is unmeasurable, in proof's order", () => {
    const why = (p: Partial<Wire.PoseReport>) => {
      const r = readPose(pose(p));
      return r.state === "unmeasurable" ? r.why : null;
    };
    expect(why({ usable: null, provenance: { ...pose().provenance, not_checked: ["puppet unreachable"] } })).toBe(
      "pose not measured: puppet unreachable",
    );
    expect(why({ usable: 9 })).toBe("9 usable pose(s), need at least 10");
    expect(why({ usable: 15, count: 40 })).toBe("15/40 images have a usable pose, need at least 50%");
    expect(why({ comparable_share: 0.5 })).toBe("comparable pose share 0.50, need at least 0.80");
    expect(why({ comparable_share: null })).toBe("comparable pose share unknown, need at least 0.80");
    expect(why({ diversity: null })).toBe("pose diversity not measured");
  });
});

describe("poseCopying", () => {
  it("flags an excess on enough eligible outputs, and nothing it can't define", () => {
    expect(poseCopying(comparison())).toBe(true);
    expect(poseCopying(comparison({ close_excess: 0.09 }))).toBe(false);
    expect(poseCopying(comparison({ close_eligible: 19 }))).toBe(false);
    expect(poseCopying(comparison({ close_excess: null }))).toBe(false);
    expect(poseCopying(null)).toBe(false);
  });
});

describe("coverageAxis", () => {
  it("orders by count, keeps unknown last and drops empty labels", () => {
    expect(coverageAxis({ unknown: 9, standing: 3, jumping: 5, seated: 0 })).toEqual([
      ["jumping", 5],
      ["standing", 3],
      ["unknown", 9],
    ]);
    expect(coverageAxis(undefined)).toEqual([]);
  });
});
