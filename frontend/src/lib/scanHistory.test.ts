import { describe, expect, it } from "vitest";

import { defaultCuratorConfig, type ImageResult, type ScanSummary } from "@/components/curator/types";
import { configFromSummary, withoutRelPaths } from "@/lib/scanHistory";

function image(rel: string, overrides: Partial<ImageResult> = {}): ImageResult {
  return {
    rel_path: rel,
    abs_path: `/data/images/${rel}`,
    score: 0.5,
    passed: true,
    reject_reason: null,
    similar_group: 0,
    group_size: 1,
    is_representative: true,
    is_duplicate: false,
    duplicate_of: null,
    keep_reason: "",
    sharpness: 1,
    artifact_score: 1,
    width: 800,
    height: 800,
    faces: [],
    face_count: 0,
    primary_face_cluster: null,
    primary_face_pose: null,
    primary_face_yaw: null,
    phash: "",
    score_breakdown: {},
    ...overrides,
  };
}

function summary(results: ImageResult[]): ScanSummary {
  const cfg = defaultCuratorConfig();
  cfg.profile = { ...cfg.profile, target_category: "wardrobe" };
  cfg.faces = { ...cfg.faces, enabled: true };
  cfg.config = { ...cfg.config, diversity_weight: 0.2, min_short_side: 128 };
  return {
    scan_id: "s1",
    folder: "/data/images/set",
    target_profile: cfg.profile,
    config: cfg.config,
    faces_config: cfg.faces,
    total: results.length,
    passed: results.filter((img) => img.passed).length,
    rejected: results.filter((img) => !img.passed).length,
    duplicates: 0,
    similar_clusters: 0,
    reject_reasons: {},
    face_clusters: [
      { cluster_id: "a", size: 1, representative_rel_path: "keep.jpg", representative_bbox: null },
      { cluster_id: "b", size: 1, representative_rel_path: "gone.jpg", representative_bbox: null },
    ],
    results,
    offset: 0,
    limit: null,
    returned: results.length,
  };
}

describe("configFromSummary", () => {
  it("refills the form from the scan, and keeps the short side on the floor", () => {
    const cfg = configFromSummary(summary([image("keep.jpg")]));
    expect(cfg.profile.target_category).toBe("wardrobe");
    expect(cfg.faces.enabled).toBe(true);
    expect(cfg.config.diversity_weight).toBe(0.2);
    expect(cfg.config.min_short_side).toBe(512);
  });
});

describe("withoutRelPaths", () => {
  it("drops moved rows and the identity whose representative moved", () => {
    const next = withoutRelPaths(summary([image("keep.jpg"), image("gone.jpg", { passed: false })]), ["gone.jpg"]);
    expect(next.results.map((img) => img.rel_path)).toEqual(["keep.jpg"]);
    expect(next.total).toBe(1);
    expect(next.passed).toBe(1);
    expect(next.rejected).toBe(0);
    expect(next.face_clusters.map((cluster) => cluster.cluster_id)).toEqual(["a"]);
  });

  it("leaves the scan alone when nothing moved", () => {
    const current = summary([image("keep.jpg")]);
    expect(withoutRelPaths(current, [])).toBe(current);
  });
});
