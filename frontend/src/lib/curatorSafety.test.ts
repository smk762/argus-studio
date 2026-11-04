import { describe, expect, it } from "vitest";

import { buildScanBody, clampShortSide, defaultCuratorConfig, type ImageResult } from "@/components/curator/types";
import {
  canExport,
  exposedReading,
  framesLeftOut,
  isMinorExposed,
  scanCheckedNsfw,
  thumbSafety,
} from "@/lib/curatorSafety";

function image(overrides: Partial<ImageResult> = {}): ImageResult {
  return {
    rel_path: "a.jpg",
    abs_path: "/data/images/a.jpg",
    score: 0.8,
    passed: true,
    reject_reason: null,
    similar_group: 0,
    group_size: 1,
    is_representative: true,
    is_duplicate: false,
    duplicate_of: null,
    keep_reason: "",
    sharpness: 100,
    artifact_score: 0.9,
    width: 1024,
    height: 1024,
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

const years = (age: number) => ({ age_years: age, age_source: "mivolo" as const });
const exposed = (score: number) => ({ exposed_score: score, labels: { BUTTOCKS_EXPOSED: score } });

describe("thumbSafety", () => {
  it("holds a rejected frame blurred without reading its score", () => {
    const rejected = image({
      passed: false,
      reject_reason: "resolution too low",
      nsfw: exposed(0.95),
      nudenet_failed: true,
      primary_face_attributes: years(16),
    });
    const safety = thumbSafety(rejected, true);
    expect(safety).toMatchObject({ blurred: true, revealable: false, label: "Rejected" });
    expect(safety.reason).toContain("resolution too low");
    expect(isMinorExposed(rejected)).toBe(true);
    expect(canExport(rejected)).toBe(false);
  });

  it("holds a rejected frame whose NudeNet score is missing", () => {
    const safety = thumbSafety(image({ passed: false, reject_reason: "blurry", nsfw: null }), true);
    expect(safety.revealable).toBe(false);
    expect(safety.reason).toContain("blurry");
  });

  it("does not treat a missing score as clear once NudeNet ran", () => {
    const unknown = thumbSafety(image({ nsfw: null }), true);
    expect(unknown).toMatchObject({ blurred: true, revealable: true, label: "Not checked" });
    expect(thumbSafety(image({ nsfw: null }), false).blurred).toBe(false);
  });

  it("holds an under-18 face that NudeNet never scored", () => {
    const safety = thumbSafety(image({ nsfw: null, primary_face_attributes: years(17) }), true);
    expect(safety).toMatchObject({ blurred: true, revealable: false });
  });

  it("holds minor-exposed and never offers it for export", () => {
    const minor = image({ nsfw: exposed(0.2), primary_face_attributes: years(17.4) });
    expect(isMinorExposed(minor)).toBe(true);
    expect(thumbSafety(minor, true)).toMatchObject({ blurred: true, revealable: false, label: "Stays blurred" });
    expect(canExport(minor)).toBe(false);
    expect(isMinorExposed(image({ nsfw: exposed(0.2), primary_face_attributes: years(18) }))).toBe(false);
  });

  it("blurs at the exposed line and lets a click reveal a passing adult frame", () => {
    expect(thumbSafety(image({ nsfw: exposed(0.24) }), true).blurred).toBe(false);
    const high = thumbSafety(image({ nsfw: exposed(0.25) }), true);
    expect(high).toMatchObject({ blurred: true, revealable: true, label: "Blurred" });
    expect(canExport(image({ nsfw: exposed(0.9) }))).toBe(true);
  });

  it("reads an exposed label when the score field is quiet", () => {
    const img = image({ nsfw: { exposed_score: 0, labels: { FEMALE_BREAST_EXPOSED: 0.4 } } });
    expect(exposedReading(img)).toBe(0.4);
    expect(thumbSafety(img, true).blurred).toBe(true);
  });

  it("keeps a NudeNet failure blurred even when EraX's score is low", () => {
    const safety = thumbSafety(image({ nudenet_failed: true, nsfw: exposed(0.1) }), true);
    expect(safety).toMatchObject({ blurred: true, revealable: true, label: "NudeNet failed" });
  });

  it("counts a body-only age and the set age", () => {
    const body = image({
      nsfw: exposed(0.3),
      people: [{ face_index: null, age_years: 15, age_source: "mivolo" }],
    });
    expect(isMinorExposed(body)).toBe(true);
    const set = image({ nsfw: exposed(0.3), set_age: { years: 16 } });
    expect(isMinorExposed(set)).toBe(true);
  });
});

describe("scanCheckedNsfw", () => {
  it("is true only when the finished scan says NudeNet ran", () => {
    expect(scanCheckedNsfw({})).toBe(false);
    expect(scanCheckedNsfw({ nsfw_config: { enabled: false } })).toBe(false);
    expect(scanCheckedNsfw({ nsfw_config: { enabled: null } })).toBe(false);
    expect(scanCheckedNsfw({ nsfw_config: { enabled: true } })).toBe(true);
  });
});

describe("framesLeftOut", () => {
  it("names the reject reason when the export is smaller than the selection", () => {
    const kept = image({ rel_path: "kept.jpg" });
    const dropped = image({ rel_path: "small.jpg", passed: false, reject_reason: "resolution too low" });
    const minor = image({
      rel_path: "young.jpg",
      nsfw: exposed(0.5),
      primary_face_attributes: years(16),
    });
    const note = framesLeftOut([kept, dropped, minor], (rel) => rel === "kept.jpg");
    expect(note).toBe(
      "2 of 3 selected images were not exported: small.jpg (resolution too low); young.jpg (minor-exposed).",
    );
    expect(framesLeftOut([kept], () => true)).toBeNull();
  });
});

describe("short side floor", () => {
  it("never sends a short side under 512", () => {
    expect(clampShortSide(128)).toBe(512);
    expect(clampShortSide(512)).toBe(512);
    expect(clampShortSide(Number.NaN)).toBe(512);
    const cfg = defaultCuratorConfig();
    cfg.config.min_short_side = 128;
    expect(buildScanBody("/data/images", cfg).config).toMatchObject({ min_short_side: 512 });
  });
});
