import { describe, expect, it } from "vitest";

import {
  applyEdits,
  compositeScore,
  editsToUpdates,
  hitlDecision,
  imageState,
  normalizeEdits,
  type EvalReport,
  type HitlEdit,
  type ImageScores,
  type MetricScores,
} from "@/lib/proofApi";

const NO_METRICS: MetricScores = { identity: null, clip_score: null, aesthetic: null, preference: null, safety: null };

function image(id: string, overrides: Partial<ImageScores> = {}): ImageScores {
  return {
    image_id: id,
    seed: 0,
    metrics: NO_METRICS,
    hitl_rating: null,
    hitl_rater: null,
    reject_reasons: [],
    passed: null,
    duplicate_group: null,
    ...overrides,
  };
}

function report(images: ImageScores[]): EvalReport {
  return {
    run_id: "run-1",
    images,
    aggregate: {
      n_images: images.length,
      n_passed: 0,
      pass_rate: 0,
      means: NO_METRICS,
      n_groups: null,
      n_needs_hitl: 0,
      diversity: null,
    },
    scorers: [],
    verdict: { passed: false, pending: false, reasons: [] },
    created_at: null,
  };
}

describe("hitlDecision / imageState", () => {
  it("rejects on any reason, passes at rating >= 3, else undecided", () => {
    expect(hitlDecision(5, [{ code: "artifact" }])).toBe(false);
    expect(hitlDecision(3, [])).toBe(true);
    expect(hitlDecision(2, [])).toBe(false);
    expect(hitlDecision(null, [])).toBeNull();
  });

  it("lets a human decision override the gate", () => {
    expect(imageState(image("a", { passed: false, hitl_rating: 4 }))).toBe("pass");
    expect(imageState(image("a", { passed: true }))).toBe("pass");
    expect(imageState(image("a", { passed: false }))).toBe("fail");
    expect(imageState(image("a"))).toBe("needs_hitl");
  });
});

describe("compositeScore", () => {
  it("averages only the metrics actually scored", () => {
    expect(compositeScore({ ...NO_METRICS, clip_score: 0.8, preference: 0.4 })).toBeCloseTo(0.6);
    expect(compositeScore(NO_METRICS)).toBeNull();
  });
});

describe("applyEdits", () => {
  it("collapses near-duplicate groups: one passing member passes the group", () => {
    const r = applyEdits(
      report([
        image("a", { duplicate_group: 1, passed: false }),
        image("b", { duplicate_group: 1, passed: true }),
        image("c", { passed: true }),
        image("d", { passed: true }),
      ]),
      new Map(),
      null,
    );
    expect(r.aggregate.n_groups).toBe(3);
    expect(r.aggregate.n_passed).toBe(3);
    expect(r.verdict.passed).toBe(true);
  });

  it("is pending when undecided groups could still clear the bar", () => {
    const r = applyEdits(report([image("a", { passed: true }), image("b"), image("c"), image("d", { passed: true })]), new Map(), null);
    expect(r.verdict.passed).toBe(false);
    expect(r.verdict.pending).toBe(true);
    expect(r.aggregate.n_needs_hitl).toBe(2);
  });

  it("applies a reviewer's edits and records the rater", () => {
    const edits = new Map<string, HitlEdit>([["b", { hitl_rating: 4, reject_reasons: [] }]]);
    const r = applyEdits(report([image("a", { passed: true }), image("b", { passed: false })]), edits, "sam");
    const b = r.images.find((i) => i.image_id === "b")!;
    expect(b.passed).toBe(true);
    expect(b.hitl_rater).toBe("sam");
    expect(r.aggregate.pass_rate).toBe(1);
  });

  it("falls back to the gate's decision when a rating is cleared", () => {
    const edits = new Map<string, HitlEdit>([["a", { hitl_rating: null, reject_reasons: [] }]]);
    const r = applyEdits(report([image("a", { passed: false, hitl_rating: 5 })]), edits, null);
    expect(r.images[0].passed).toBe(false);
  });
});

describe("edit laundering", () => {
  const edits = new Map<string, HitlEdit>([
    [
      "a",
      {
        hitl_rating: 1,
        reject_reasons: [
          { code: "artifact", note: "auto: aesthetic 0.21 < 0.30" },
          { code: "anatomy", note: "extra finger" },
        ],
      },
    ],
  ]);

  it("drops machine notes from endorsed reasons, keeps the reviewer's own", () => {
    expect(editsToUpdates(edits)).toEqual([
      { image_id: "a", hitl_rating: 1, reject_reasons: [{ code: "artifact" }, { code: "anatomy", note: "extra finger" }] },
    ]);
  });

  it("launders locally applied edits the same way as sent ones", () => {
    expect(normalizeEdits(edits).get("a")!.reject_reasons).toEqual(editsToUpdates(edits)[0].reject_reasons);
  });
});
