import { describe, expect, it } from "vitest";

import { defaultCuratorConfig, type FaceCluster, type ImageResult, type ScanSummary } from "@/components/curator/types";
import { imagePending, mergeChunk, pendingCaption, type ScanChunk } from "@/lib/scanChunks";

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
    width: 512,
    height: 512,
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

function chunk(overrides: Partial<ScanChunk> = {}): ScanChunk {
  return {
    scan_id: "s1",
    folder: "/data/images",
    phase: "scoring",
    done: 1,
    total: 2,
    pending_checks: ["nsfw"],
    results: [image("a.jpg")],
    ...overrides,
  };
}

const cluster = (id: string): FaceCluster =>
  ({ cluster_id: id, size: 1, representative_rel_path: "a.jpg" }) as FaceCluster;

describe("mergeChunk", () => {
  it("keeps the scan the user asked for on the first batch", () => {
    const requested = defaultCuratorConfig();
    requested.profile = { ...requested.profile, target_category: "wardrobe" };
    requested.faces = { ...requested.faces, enabled: true };
    const merged = mergeChunk(null, chunk(), requested);
    expect(merged.target_profile.target_category).toBe("wardrobe");
    expect(merged.faces_config.enabled).toBe(true);
  });

  it("keeps first-seen order and replaces the same path", () => {
    const first = mergeChunk(null, chunk({ results: [image("a.jpg", { score: 0.2 }), image("b.jpg")] }));
    const second = mergeChunk(
      first,
      chunk({ results: [image("a.jpg", { score: 0.9, nsfw: { exposed_score: 0.1 } })], total: 2 }),
    );
    expect(second.results.map((img) => img.rel_path)).toEqual(["a.jpg", "b.jpg"]);
    expect(second.results[0].score).toBe(0.9);
    expect(second.scan_id).toBe("s1");
    expect(second.total).toBe(2);
  });

  it("appends a new path and keeps the high-water total", () => {
    const current = mergeChunk(null, chunk({ total: 8, results: [image("a.jpg")] }));
    const next = mergeChunk(current, chunk({ total: 3, results: [image("c.jpg")] }));
    expect(next.results.map((img) => img.rel_path)).toEqual(["a.jpg", "c.jpg"]);
    expect(next.total).toBe(8);
    expect(next.passed).toBe(2);
  });

  it("replaces clusters when the chunk sends an empty list, and keeps them when the field is absent", () => {
    const withClusters = mergeChunk(null, chunk({ face_clusters: [cluster("id-1")] }));
    expect(withClusters.face_clusters).toHaveLength(1);
    const cleared = mergeChunk(withClusters, chunk({ face_clusters: [], results: [] }));
    expect(cleared.face_clusters).toEqual([]);
    const kept = mergeChunk(withClusters, chunk({ results: [image("a.jpg", { score: 0.4 })] }));
    expect(kept.face_clusters.map((c) => c.cluster_id)).toEqual(["id-1"]);
  });

  it("counts rejects and duplicates from the frames on screen", () => {
    const merged = mergeChunk(
      null,
      chunk({
        results: [
          image("ok.jpg"),
          image("no.jpg", { passed: false, reject_reason: "blurry" }),
          image("dup.jpg", { is_duplicate: true }),
        ],
      }),
    );
    expect(merged.passed).toBe(2);
    expect(merged.rejected).toBe(1);
    expect(merged.duplicates).toBe(1);
    expect(merged.returned).toBe(3);
  });
});

describe("imagePending", () => {
  it("names the checks this frame has not received", () => {
    const fresh = image("a.jpg");
    expect(imagePending(fresh, ["faces", "nsfw", "guard"])).toEqual(["faces", "nsfw", "guard"]);
    expect(imagePending(image("a.jpg", { face_count: 1, faces: [{} as never] }), ["faces"])).toEqual([]);
    expect(imagePending(image("a.jpg", { nsfw: { exposed_score: 0 } }), ["nsfw"])).toEqual([]);
    expect(imagePending(image("a.jpg", { guard: { safe: true } }), ["guard"])).toEqual([]);
    expect(imagePending(image("a.jpg", { passed: false }), ["nsfw", "faces"])).toEqual([]);
    expect(imagePending(fresh, [])).toEqual([]);
  });

  it("captions the pending checks", () => {
    expect(pendingCaption(["nsfw", "guard"])).toBe("nudity, policy");
  });
});

describe("mergeChunk preserves a previous summary's scan fields", () => {
  it("does not invent a new scan id over an existing one when the chunk omits it", () => {
    const current = { scan_id: "kept", folder: "/kept", results: [] } as unknown as ScanSummary;
    const merged = mergeChunk(current, chunk({ scan_id: "", folder: "", results: [image("a.jpg")] }));
    expect(merged.scan_id).toBe("kept");
    expect(merged.folder).toBe("/kept");
  });
});
