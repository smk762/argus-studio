import { describe, expect, it } from "vitest";

import { applyEdits, type EvalReport, type HitlEdit, type ImageScores } from "@/lib/proofApi";
import { refinementSaveVia,
  applyRefinement,
  passingSubset,
  refinedRanking,
  refinementUpdates,
  withRefinementEdit,
  type RefinementEdit,
} from "@/lib/proofRefinement";
import { DEMO_REPORT } from "@/lib/proofSample";

// The refinement stage mirrors argus_proof.refinement; these pin the rules the
// demo's local apply and the live ordering share with the server.

function img(id: string, over: Partial<ImageScores> = {}): ImageScores {
  return { ...DEMO_REPORT.images[0], image_id: id, hitl_rating: null, passed: true, refinement: null, ...over };
}

function report(images: ImageScores[]): EvalReport {
  return { ...DEMO_REPORT, images };
}

const ids = (images: ImageScores[]) => images.map((i) => i.image_id);

describe("passingSubset", () => {
  it("keeps only images the quality stage passed", () => {
    const out = passingSubset([img("a"), img("b", { passed: null }), img("c", { passed: false })]);
    expect(ids(out)).toEqual(["a"]);
  });
});

describe("refinedRanking", () => {
  it("puts refined images first, by rank, then first-pass rating, then id", () => {
    const images = [
      img("d", { hitl_rating: 5 }),
      img("c", { refinement: { rank: 3, notes: null, rater: null } }),
      img("a", { refinement: { rank: 5, notes: null, rater: null } }),
      img("b", { refinement: { rank: 3, notes: null, rater: null }, hitl_rating: 4 }),
      img("e", { hitl_rating: 5 }),
      img("x", { passed: false, refinement: { rank: 5, notes: null, rater: null } }),
    ];
    expect(ids(refinedRanking(images))).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("withRefinementEdit", () => {
  const stored = img("a", { refinement: { rank: 3, notes: "ok", rater: "sk" } });

  it("drops an edit that returns to the stored refinement", () => {
    let edits = withRefinementEdit(new Map(), stored, { rank: 5 });
    expect(edits.get("a")).toEqual({ rank: 5, notes: "ok" });
    edits = withRefinementEdit(edits, stored, { rank: 3 });
    expect(edits.size).toBe(0);
  });

  it("clears the note with the rank, as a retraction", () => {
    const edits = withRefinementEdit(new Map(), stored, { rank: null });
    expect(edits.get("a")).toEqual({ rank: null, notes: null });
  });

  it("does not count un-ranking an unrefined image as a change", () => {
    expect(withRefinementEdit(new Map(), img("b"), { rank: null }).size).toBe(0);
  });
});

describe("refinementUpdates", () => {
  it("sends a retraction without a note and a rank with its note as typed", () => {
    const edits = new Map<string, RefinementEdit>([
      ["a", { rank: null, notes: null }],
      ["b", { rank: 4, notes: null }],
    ]);
    expect(refinementUpdates(edits)).toEqual([
      { image_id: "a", rank: null },
      { image_id: "b", rank: 4, notes: "" },
    ]);
  });
});

describe("applyRefinement", () => {
  const base = report([img("a", { refinement: { rank: 2, notes: "keep", rater: "old" } }), img("b"), img("f", { passed: false })]);

  it("replaces the rank, keeps an omitted rater, and leaves the verdict alone", () => {
    const out = applyRefinement(base, new Map([["a", { rank: 5, notes: null }]]), null);
    expect(out.images[0].refinement).toEqual({ rank: 5, notes: "", rater: "old" });
    expect(out.verdict).toBe(base.verdict);
    expect(out.aggregate).toBe(base.aggregate);
  });

  it("stamps the rater on a new refinement", () => {
    const out = applyRefinement(base, new Map([["b", { rank: 4, notes: "nice" }]]), "sk");
    expect(out.images[1].refinement).toEqual({ rank: 4, notes: "nice", rater: "sk" });
  });

  it("retracts the whole layer on a null rank", () => {
    const out = applyRefinement(base, new Map([["a", { rank: null, notes: null }]]), "sk");
    expect(out.images[0].refinement).toBeNull();
  });

  it("refuses an image outside the passing subset", () => {
    expect(() => applyRefinement(base, new Map([["f", { rank: 3, notes: null }]]), null)).toThrow(/passing subset/);
  });
});

describe("a review that fails a refined image", () => {
  it("drops its refinement, as argus_proof.reports.apply_hitl does", () => {
    const r = report([img("a", { refinement: { rank: 4, notes: null, rater: null } })]);
    const fail = new Map<string, HitlEdit>([["a", { hitl_rating: null, reject_reasons: [{ code: "anatomy" }] }]]);
    expect(applyEdits(r, fail, null).images[0].refinement).toBeNull();
    const pass = new Map<string, HitlEdit>([["a", { hitl_rating: 5, reject_reasons: [] }]]);
    expect(applyEdits(r, pass, null).images[0].refinement).toEqual({ rank: 4, notes: null, rater: null });
  });
});

// Audit pack-argus-studio-81e5e8aca4: the label and the save must pick the same path.
describe("refinementSaveVia", () => {
  it("applies locally whenever the panel isn't live, whatever a stale capability says", () => {
    expect(refinementSaveVia(false, true)).toBe("local");
    expect(refinementSaveVia(false, false)).toBe("local");
    expect(refinementSaveVia(false, null)).toBe("local");
  });

  it("posts only to a live host that permits writes", () => {
    expect(refinementSaveVia(true, true)).toBe("server");
    expect(refinementSaveVia(true, false)).toBeNull();
    expect(refinementSaveVia(true, null)).toBeNull();
  });
});
