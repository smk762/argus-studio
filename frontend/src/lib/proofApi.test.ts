import { describe, expect, it } from "vitest";

import {
  applyEdits,
  categoryChoices,
  compositeScore,
  editsToUpdates,
  hitlDecision,
  imageState,
  normalizeEdits,
  POLICY_CATEGORIES,
  policyLabel,
  reasonLabel,
  toggleUnsafeCategory,
  unsafeBreakdown,
  unsafeCategories,
  type EvalReport,
  type HitlEdit,
  type ImageScores,
  type MetricScores,
  type RejectReason,
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

  it("keeps a category when it drops the machine note beside it", () => {
    const flagged = new Map<string, HitlEdit>([
      ["a", { hitl_rating: null, reject_reasons: [{ code: "unsafe", category: "violence", note: "auto: safety 0.10" }] }],
    ]);
    expect(editsToUpdates(flagged)[0].reject_reasons).toEqual([{ code: "unsafe", category: "violence" }]);
    expect(normalizeEdits(flagged).get("a")!.reject_reasons).toEqual([{ code: "unsafe", category: "violence" }]);
  });

  it("sends a category on a reason with no note, unchanged", () => {
    const flagged = new Map<string, HitlEdit>([
      ["a", { hitl_rating: 2, reject_reasons: [{ code: "unsafe", category: "hate" }] }],
    ]);
    expect(JSON.parse(JSON.stringify(editsToUpdates(flagged)))[0].reject_reasons).toEqual([
      { code: "unsafe", category: "hate" },
    ]);
  });
});

describe("policy categories", () => {
  it("mirrors the proof-policy-1 slugs", () => {
    expect(POLICY_CATEGORIES.map((c) => c.slug)).toEqual(["sexual", "violence", "hate", "self_harm", "weapons", "illegal"]);
  });

  it("labels a known slug, and shows an unknown one as itself", () => {
    expect(policyLabel("self_harm")).toBe("Self-harm");
    expect(policyLabel("deepfake")).toBe("deepfake");
  });

  it("names the category only on an unsafe reason", () => {
    expect(reasonLabel({ code: "unsafe", category: "violence" })).toBe("Unsafe · Violence");
    expect(reasonLabel({ code: "unsafe" })).toBe("Unsafe");
    expect(reasonLabel({ code: "anatomy", category: "violence" })).toBe("Deformation");
  });

  it("offers a stored slug outside the taxonomy, so it can be seen and cleared", () => {
    expect(categoryChoices([{ code: "unsafe" }])).toHaveLength(POLICY_CATEGORIES.length);
    const choices = categoryChoices([{ code: "unsafe", category: "deepfake" }]);
    expect(choices).toHaveLength(POLICY_CATEGORIES.length + 1);
    expect(choices).toContain("deepfake");
  });

  it("ignores a category on another code, and an empty one", () => {
    expect(unsafeCategories([{ code: "anatomy", category: "hate" }, { code: "unsafe", category: "" }])).toEqual([]);
  });
});

describe("toggleUnsafeCategory", () => {
  it("fills an uncategorised reason and keeps its note", () => {
    const reasons: RejectReason[] = [{ code: "unsafe", note: "safety 0.1 < hard gate 0.5" }];
    expect(toggleUnsafeCategory(reasons, "violence")).toEqual([
      { code: "unsafe", category: "violence", note: "safety 0.1 < hard gate 0.5" },
    ]);
  });

  it("adds a second category as its own reason", () => {
    expect(toggleUnsafeCategory([{ code: "unsafe", category: "violence" }], "weapons")).toEqual([
      { code: "unsafe", category: "violence" },
      { code: "unsafe", category: "weapons" },
    ]);
  });

  it("removes one of several categories", () => {
    const reasons: RejectReason[] = [
      { code: "anatomy" },
      { code: "unsafe", category: "violence" },
      { code: "unsafe", category: "weapons" },
    ];
    expect(toggleUnsafeCategory(reasons, "violence")).toEqual([{ code: "anatomy" }, { code: "unsafe", category: "weapons" }]);
  });

  it("keeps the reject when its last category is cleared, so the verdict doesn't move", () => {
    const cleared = toggleUnsafeCategory([{ code: "unsafe", category: "violence" }], "violence");
    expect(cleared).toEqual([{ code: "unsafe", category: null }]);
    expect(hitlDecision(5, cleared)).toBe(false);
  });

  it("leaves other reasons and the input alone", () => {
    const reasons: RejectReason[] = [{ code: "anatomy", note: "extra finger" }, { code: "unsafe" }];
    const next = toggleUnsafeCategory(reasons, "hate");
    expect(next[0]).toBe(reasons[0]);
    expect(reasons[1]).toEqual({ code: "unsafe" });
  });
});

describe("unsafeBreakdown", () => {
  it("is empty without an unsafe reject", () => {
    const images = [image("a"), image("b", { reject_reasons: [{ code: "anatomy", category: "violence" }] })];
    expect(unsafeBreakdown(images)).toEqual({ images: 0, slices: [] });
  });

  it("counts by category, largest first, ties by slug, uncategorised last", () => {
    const unsafe = (category?: string | null): Partial<ImageScores> => ({ reject_reasons: [{ code: "unsafe", category }] });
    const images = [
      image("a", unsafe()),
      image("b", unsafe(null)),
      image("c", unsafe("")),
      image("d", unsafe("weapons")),
      image("e", unsafe("hate")),
      image("f", unsafe("violence")),
      image("g", unsafe("violence")),
    ];
    expect(unsafeBreakdown(images)).toEqual({
      images: 7,
      slices: [
        { category: "violence", images: 2 },
        { category: "hate", images: 1 },
        { category: "weapons", images: 1 },
        { category: null, images: 3 },
      ],
    });
  });

  it("counts an image once in total, and once per category", () => {
    const images = [
      image("a", {
        reject_reasons: [
          { code: "unsafe", category: "violence" },
          { code: "unsafe", category: "violence" },
          { code: "unsafe", category: "weapons" },
          { code: "anatomy" },
        ],
      }),
    ];
    expect(unsafeBreakdown(images)).toEqual({
      images: 1,
      slices: [
        { category: "violence", images: 1 },
        { category: "weapons", images: 1 },
      ],
    });
  });

  it("keeps a slug outside the taxonomy", () => {
    const images = [image("a", { reject_reasons: [{ code: "unsafe", category: "deepfake" }] })];
    expect(unsafeBreakdown(images).slices).toEqual([{ category: "deepfake", images: 1 }]);
  });

  it("leaves out an image under the safety floor with no unsafe reason", () => {
    const low = { ...NO_METRICS, safety: 0.05 };
    expect(unsafeBreakdown([image("a", { metrics: low, passed: false })]).images).toBe(0);
  });

  it("reflects a reviewer's unsaved edit", () => {
    const edits = new Map<string, HitlEdit>([
      ["a", { hitl_rating: null, reject_reasons: [{ code: "unsafe", category: "hate" }] }],
    ]);
    const edited = applyEdits(report([image("a")]), edits, null);
    expect(unsafeBreakdown(edited.images).slices).toEqual([{ category: "hate", images: 1 }]);
  });
});
