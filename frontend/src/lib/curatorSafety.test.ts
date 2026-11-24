import { describe, expect, it } from "vitest";

import { buildScanBody, clampShortSide, defaultCuratorConfig, type ImageResult } from "@/components/curator/types";
import {
  canExport,
  exportBlockReason,
  isDeletableReject,
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

describe("thumbSafety: SingGuard", () => {
  const passing = (extra: Partial<ImageResult>) => ({ rel_path: "a", passed: true, nsfw: { exposed_score: 0, labels: {} }, ...extra }) as ImageResult;

  it("veils a clear frame any policy judged unsafe, and it can be revealed", () => {
    expect(thumbSafety(passing({ guard: { safe: false } }), true)).toMatchObject({ blurred: true, revealable: true, label: "Flagged" });
    expect(thumbSafety(passing({ guard: { safe: true }, guard_variants: { x: { safe: false } } }), true).blurred).toBe(true);
  });

  it("does the same on a scan that never ran NudeNet", () => {
    expect(thumbSafety(passing({ nsfw: null, guard: { safe: false } }), false).blurred).toBe(true);
    expect(thumbSafety(passing({ nsfw: null }), false).blurred).toBe(false);
  });

  it("leaves a safe verdict clear", () => {
    expect(thumbSafety(passing({ guard: { safe: true } }), true).blurred).toBe(false);
  });

  it("never turns a hold into something revealable", () => {
    const held = passing({ passed: false, guard: { safe: false } });
    expect(thumbSafety(held, true).revealable).toBe(false);
  });
});

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

  it("holds a frame while its nudity check is still running", () => {
    const safety = thumbSafety(image({ nsfw: null }), false, ["nsfw", "faces"]);
    expect(safety).toMatchObject({ blurred: true, revealable: false, label: "Checking" });
    expect(thumbSafety(image({ passed: false, nsfw: null }), true, ["nsfw"]).label).toBe("Rejected");
  });

  it("holds exposure while the ages are still coming", () => {
    const safety = thumbSafety(image({ nsfw: exposed(0.4) }), true, ["faces"]);
    expect(safety).toMatchObject({ blurred: true, revealable: false, label: "Stays blurred" });
    expect(thumbSafety(image({ nsfw: exposed(0.4), primary_face_attributes: years(30) }), true, ["faces"]).label).toBe(
      "Blurred",
    );
  });

  // Audit pack-argus-studio-8cc2abd9e2: the set's age is a stand-in, not this frame's measured age.
  it("holds exposure on an adult set while the frame's own ages are still coming", () => {
    const img = image({ nsfw: exposed(0.4), set_age: { years: 30 } as ImageResult["set_age"] });
    expect(thumbSafety(img, true, ["faces"])).toMatchObject({ blurred: true, revealable: false, label: "Stays blurred" });
    expect(thumbSafety(img, true)).toMatchObject({ blurred: true, revealable: true, label: "Blurred" });
  });

  // Audit pack-argus-studio-9c5d014163: an under-18 age would hold these for good.
  it("holds a frame with no usable nudity score while the ages are still coming", () => {
    const failed = image({ nudenet_failed: true });
    expect(thumbSafety(failed, true, ["faces"])).toMatchObject({ blurred: true, revealable: false, label: "Stays blurred" });
    expect(thumbSafety(failed, true)).toMatchObject({ revealable: true, label: "NudeNet failed" });
    const unscored = image({ nsfw: null });
    expect(thumbSafety(unscored, true, ["faces"])).toMatchObject({ blurred: true, revealable: false, label: "Stays blurred" });
    expect(thumbSafety(unscored, true)).toMatchObject({ revealable: true, label: "Not checked" });
    // A measured adult age has landed, so the usual veil applies.
    expect(thumbSafety(image({ nudenet_failed: true, primary_face_attributes: years(30) }), true, ["faces"]).revealable).toBe(true);
    // A clear score needs no age.
    expect(thumbSafety(image({ nsfw: exposed(0) }), true, ["faces"]).blurred).toBe(false);
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

// Audit pack-argus-studio-8a6b22389c: export already holds these back; display must not show them in the clear.
describe("under-18 frames on a scan that never ran NudeNet", () => {
  it("holds an under-18 face, as export does", () => {
    const minor = image({ nsfw: null, primary_face_attributes: years(16) });
    expect(thumbSafety(minor, false)).toMatchObject({ blurred: true, revealable: false, label: "Stays blurred" });
    expect(canExport(minor)).toBe(false);
  });

  it("holds an unscored frame while its ages are still coming, then clears an adult", () => {
    const unscored = image({ nsfw: null });
    expect(thumbSafety(unscored, false, ["faces"])).toMatchObject({ blurred: true, revealable: false });
    expect(thumbSafety(image({ nsfw: null, primary_face_attributes: years(30) }), false, ["faces"]).blurred).toBe(false);
    expect(thumbSafety(unscored, false).blurred).toBe(false);
  });
});

describe("under-18 frames with no nudity score", () => {
  it("holds an under-18 frame whose NudeNet check failed, unrevealably", () => {
    const failed = image({ nudenet_failed: true, primary_face_attributes: years(15) });
    expect(thumbSafety(failed, true)).toMatchObject({ blurred: true, revealable: false, label: "Stays blurred" });
    const adult = image({ nudenet_failed: true, primary_face_attributes: years(30) });
    expect(thumbSafety(adult, true)).toMatchObject({ revealable: true, label: "NudeNet failed" });
  });

  it("does not export what display holds", () => {
    const unscored = image({ primary_face_attributes: years(15) });
    expect(thumbSafety(unscored, true).revealable).toBe(false);
    expect(canExport(unscored)).toBe(false);
    expect(exportBlockReason(unscored)).toContain("not scored");

    const failed = image({ nudenet_failed: true, nsfw: exposed(0.05), primary_face_attributes: years(15) });
    expect(canExport(failed)).toBe(false);
    expect(exportBlockReason(failed)).toContain("not scored");
  });

  it("still exports scored under-18 frames with no exposure, and unscored adults", () => {
    expect(canExport(image({ nsfw: exposed(0.05), primary_face_attributes: years(15) }))).toBe(true);
    expect(canExport(image({ primary_face_attributes: years(30) }))).toBe(true);
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

describe("isDeletableReject", () => {
  const minor = {
    passed: false,
    nsfw: { exposed_score: 0.5, labels: {} },
    primary_face_attributes: { age_years: 15, age_source: "mivolo" },
  } as unknown as Partial<ImageResult>;

  it("takes rejected frames only", () => {
    expect(isDeletableReject(image({ passed: false }))).toBe(true);
    expect(isDeletableReject(image({ passed: true }))).toBe(false);
  });

  it("leaves under-18 exposed frames to their own action", () => {
    expect(isMinorExposed(image(minor))).toBe(true);
    expect(isDeletableReject(image(minor))).toBe(false);
  });

  // Audit pack-argus-studio-66af4c5559: curator's under-18 rule needs a score, so only this action can delete one.
  it("keeps an under-18 reject that has no nudity score", () => {
    const unscored = image({ ...minor, nsfw: null });
    expect(isMinorExposed(unscored)).toBe(false);
    expect(isDeletableReject(unscored)).toBe(true);
  });
});

// Audit pack-argus-studio-055b4d4382: the two never disagree, whatever `passed` holds.
describe("canExport and exportBlockReason agree", () => {
  it.each([true, false, null, undefined])("passed = %s", (passed) => {
    const img = { rel_path: "a.jpg", passed } as unknown as Parameters<typeof canExport>[0];
    expect(exportBlockReason(img) === null).toBe(canExport(img));
  });
});
