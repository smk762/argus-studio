import { describe, expect, it } from "vitest";

import type { BodyPoseLabels, PoseCluster, PosedImageResult, PosedScanSummary, PoseSummary } from "@/components/curator/types";
import {
  bodyPoseCoverage,
  hasPoseData,
  notMeasuredLine,
  POSE_DOMINANCE_MIN_ROWS,
  POSE_DOMINANCE_STRONG,
  POSE_DOMINANCE_WARN,
  poseDominance,
  poseDominanceGap,
  topPoseCluster,
} from "@/lib/curatorBodyPose";

let seq = 0;
const row = (extra: Partial<PosedImageResult> = {}): PosedImageResult =>
  ({ rel_path: `img/${seq++}.jpg`, score: 0.9, passed: true, faces: [], face_count: 0, ...extra }) as PosedImageResult;
const labels = (stance: BodyPoseLabels["stance"], arms: BodyPoseLabels["arms"] = "down", facing: BodyPoseLabels["facing"] = "front") => ({
  stance,
  arms,
  facing,
});
const posed = (cluster: number | null, l: BodyPoseLabels = labels("standing")) =>
  row({ pose_check: "ok", pose_labels: l, pose_cluster: cluster });
const clusters = (...ids: number[]): PoseCluster[] =>
  ids.map((id) => ({ id, size: 1, share: 0, medoid_rel_path: `medoid/${id}.jpg` }));
const scan = (results: PosedImageResult[], pose: PoseSummary | null = { clusters: clusters(0, 1, 2) }, enabled = true): PosedScanSummary =>
  ({ scan_id: "s", results, pose_config: { enabled }, pose }) as PosedScanSummary;
const counts = (b: { key: string; count: number }[]) => Object.fromEntries(b.map((x) => [x.key, x.count]));

describe("hasPoseData", () => {
  it("is false when the stage did not run, or ran and checked nothing", () => {
    const rows = [row(), row()];
    expect(hasPoseData(scan(rows, null, false))).toBe(false);
    expect(hasPoseData(scan(rows))).toBe(false);
    // A curator before #221 sends neither field.
    expect(hasPoseData({ scan_id: "s", results: [posed(0)] } as PosedScanSummary)).toBe(false);
    expect(bodyPoseCoverage(scan(rows, null, false), rows)).toBeNull();
  });

  it("is true once the stage ran and a row was checked, failed rows included", () => {
    expect(hasPoseData(scan([row({ pose_check: "failed" })], { clusters: [], skipped: "nothing was posed" }))).toBe(true);
    // pose_config alone counts: rows land before the scan's pose summary does.
    expect(hasPoseData(scan([posed(null)], null, true))).toBe(true);
  });
});

describe("label distributions", () => {
  it("counts each axis, with unknown as its own muted bucket last", () => {
    const rows = [
      posed(0, labels("standing", "up", "front")),
      posed(0, labels("standing", "unknown", "left")),
      posed(1, labels("unknown", "out", "unknown")),
      row({ pose_check: "unusable", pose_labels: labels("seated", "unknown", "back"), pose_cluster: null }),
    ];
    const c = bodyPoseCoverage(scan(rows), rows)!;
    expect(counts(c.stance)).toEqual({ standing: 2, jumping: 0, crouching: 0, seated: 1, lying: 0, unknown: 1 });
    expect(counts(c.arms)).toEqual({ up: 1, out: 1, down: 0, mixed: 0, unknown: 2 });
    expect(counts(c.facing)).toEqual({ front: 1, back: 1, left: 1, right: 0, unknown: 1 });
    expect(c.stance.at(-1)).toMatchObject({ key: "unknown", label: "Unknown", muted: true });
    expect(c.stance.filter((b) => b.muted).map((b) => b.key)).toEqual(["unknown"]);
  });

  it("puts a row with no labels in no bucket, and never names null", () => {
    const rows = [posed(0), row({ pose_check: "no_person", pose_labels: null }), row({ pose_check: null })];
    const c = bodyPoseCoverage(scan(rows), rows)!;
    for (const axis of [c.stance, c.arms, c.facing]) {
      expect(axis.reduce((sum, b) => sum + b.count, 0)).toBe(1);
      expect(axis.some((b) => /null/i.test(b.label) || b.key === "null")).toBe(false);
    }
  });

  it("gives a label a newer puppet adds its own bucket before unknown", () => {
    const rows = [posed(0, { stance: "kneeling", arms: "down", facing: "front" } as unknown as BodyPoseLabels)];
    const keys = bodyPoseCoverage(scan(rows), rows)!.stance.map((b) => b.key);
    expect(keys.slice(-2)).toEqual(["kneeling", "unknown"]);
  });
});

describe("not measured", () => {
  it("counts every row without a usable pose, by reason", () => {
    const rows = [
      ...Array.from({ length: 48 }, () => posed(0)),
      ...Array.from({ length: 9 }, () => row({ pose_check: "unusable", pose_labels: labels("unknown") })),
      ...Array.from({ length: 3 }, () => row({ pose_check: "no_person" })),
    ];
    const c = bodyPoseCoverage(scan(rows), rows)!;
    expect(c.notMeasured).toEqual({ total: 12, unusable: 9, noPerson: 3, failed: 0, unchecked: 0 });
    expect(notMeasuredLine(c, rows.length)).toBe("12 of 60 not measured: 9 unusable, 3 no person");
  });

  it("names failed and unchecked rows, and is silent when every row is measured", () => {
    const rows = [posed(0), row({ pose_check: "failed" }), row({ pose_check: null }), row()];
    expect(notMeasuredLine(bodyPoseCoverage(scan(rows), rows)!, 4)).toBe("3 of 4 not measured: 1 failed, 2 not checked");
    const all = [posed(0), posed(1)];
    expect(notMeasuredLine(bodyPoseCoverage(scan(all), all)!, 2)).toBeNull();
  });
});

describe("topPoseCluster", () => {
  it("takes the selection's most common cluster over its clustered rows, null clusters left out", () => {
    const rows = [posed(2), posed(2), posed(1), posed(null), posed(null), row({ pose_check: "unusable" })];
    const top = topPoseCluster(scan(rows), rows)!;
    expect(top).toEqual({ id: 2, count: 2, share: 2 / 3, medoidRelPath: "medoid/2.jpg" });
  });

  it("breaks a tie toward the lower id, the larger scan cluster", () => {
    const rows = [posed(3), posed(1), posed(3), posed(1)];
    expect(topPoseCluster(scan(rows, { clusters: clusters(0, 1, 3) }), rows)?.id).toBe(1);
  });

  it("is null when the scan has no clusters or no selected row is clustered", () => {
    const rows = [posed(0)];
    expect(topPoseCluster(scan(rows, { clusters: [], skipped: "over the set cap" }), rows)).toBeNull();
    expect(topPoseCluster(scan([posed(null)]), [posed(null)])).toBeNull();
  });

  it("keeps a missing medoid as null rather than a path", () => {
    const rows = [posed(0)];
    const pose = { clusters: [{ id: 0, size: 1, share: 1, medoid_rel_path: null }] };
    expect(topPoseCluster(scan(rows, pose), rows)?.medoidRelPath).toBeNull();
  });
});

describe("dominance", () => {
  it("warns from 0.4 and strongly from 0.75, with at least 10 clustered rows", () => {
    expect([POSE_DOMINANCE_WARN, POSE_DOMINANCE_STRONG, POSE_DOMINANCE_MIN_ROWS]).toEqual([0.4, 0.75, 10]);
    expect(poseDominance(0.39, 100)).toBe("none");
    expect(poseDominance(0.4, 10)).toBe("warn");
    expect(poseDominance(0.74, 10)).toBe("warn");
    expect(poseDominance(0.75, 10)).toBe("strong");
    expect(poseDominance(1, 9)).toBe("none");
  });

  it("counts only clustered rows toward the minimum and the share", () => {
    // 4 of 10 clustered rows in cluster 0, plus unclustered rows that must not dilute the share.
    const rows = [...Array.from({ length: 4 }, () => posed(0)), ...[1, 2, 1, 2, 1, 2].map((id) => posed(id)), posed(null), posed(null)];
    const c = bodyPoseCoverage(scan(rows), rows)!;
    expect(c.clustered).toBe(10);
    expect(c.top?.share).toBe(0.4);
    expect(c.dominance).toBe("warn");
    expect(poseDominanceGap(c)).toEqual({ text: "40% share one body pose (4 of 10 clustered)", strong: false });
  });

  it("raises a strong gap at collapse, and none under the minimum", () => {
    const collapsed = [...Array.from({ length: 8 }, () => posed(0)), posed(1), posed(2)];
    const gap = poseDominanceGap(bodyPoseCoverage(scan(collapsed), collapsed)!);
    expect(gap?.strong).toBe(true);
    expect(gap?.text).toMatch(/^Pose collapse: 80% share one body pose \(8 of 10 clustered\)/);
    const small = Array.from({ length: 9 }, () => posed(0));
    const c = bodyPoseCoverage(scan(small), small)!;
    expect(c.top?.share).toBe(1);
    expect(c.dominance).toBe("none");
    expect(poseDominanceGap(c)).toBeNull();
  });
});

describe("stale and skipped", () => {
  it("passes the scan's flags through", () => {
    const rows = [posed(0)];
    const c = bodyPoseCoverage(scan(rows, { clusters: clusters(0), stale: true }), rows)!;
    expect(c.stale).toBe(true);
    expect(c.skipped).toBeNull();
  });

  it("keeps the labels but drops the headline and the gap when clustering was skipped", () => {
    const rows = Array.from({ length: 12 }, () => row({ pose_check: "ok", pose_labels: labels("standing"), pose_cluster: null }));
    const c = bodyPoseCoverage(scan(rows, { clusters: [], skipped: "the set is over the cap" }), rows)!;
    expect(c.skipped).toBe("the set is over the cap");
    expect(c.stale).toBe(false);
    expect(c.top).toBeNull();
    expect(c.dominance).toBe("none");
    expect(poseDominanceGap(c)).toBeNull();
    expect(counts(c.stance).standing).toBe(12);
    expect(c.notMeasured.total).toBe(0);
  });
});
