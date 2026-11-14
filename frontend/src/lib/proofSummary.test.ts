import { describe, expect, it } from "vitest";

import { applyEdits, needsReviewFrames, summaryFromReport, withReportSummary, type HitlEdit, type ReportSummary } from "@/lib/proofApi";
import { DEMO_REPORT, DEMO_SUMMARY } from "@/lib/proofSample";

// The /proof run list must agree with the open report after "Apply review".
// It used to keep the pre-review line ("29% · 4 to review") beside a header
// that already said 43% with 3 to review.

const OTHER: ReportSummary = {
  run_id: "other-run",
  passed: true,
  pending: false,
  pass_rate: 0.9,
  n_images: 10,
  n_groups: 10,
  n_needs_hitl: 0,
  n_refined: 2,
  created_at: "2026-07-01T00:00:00Z",
};

/** The synthetic sample with one image awaiting review rated as a pass. */
function reviewedSample() {
  const pending = DEMO_REPORT.images.find((i) => i.passed === null)!;
  const edits = new Map<string, HitlEdit>([[pending.image_id, { hitl_rating: 5, reject_reasons: [] }]]);
  return applyEdits(DEMO_REPORT, edits, null);
}

describe("summaryFromReport", () => {
  it("matches the bundled demo summary", () => {
    expect(summaryFromReport(DEMO_REPORT)).toEqual(DEMO_SUMMARY);
  });
});

describe("withReportSummary", () => {
  it("refreshes the reviewed run's pass rate and HITL count from the recomputed report", () => {
    const updated = reviewedSample();
    // The review actually moved the numbers, so the test can see a stale line.
    expect(updated.aggregate.pass_rate).toBeGreaterThan(DEMO_SUMMARY.pass_rate);
    expect(updated.aggregate.n_needs_hitl).toBe(DEMO_SUMMARY.n_needs_hitl - 1);

    const [line] = withReportSummary([DEMO_SUMMARY], updated);
    expect(line.pass_rate).toBe(updated.aggregate.pass_rate);
    expect(line.n_needs_hitl).toBe(updated.aggregate.n_needs_hitl);
    expect(line.passed).toBe(updated.verdict.passed);
    expect(line.pending).toBe(updated.verdict.pending);
  });

  it("leaves other runs, the order and the list's own created_at and n_refined alone", () => {
    const updated = reviewedSample();
    const listed = { ...DEMO_SUMMARY, created_at: "listed-at", n_refined: 3 };
    const out = withReportSummary([OTHER, listed], updated);
    expect(out[0]).toBe(OTHER);
    expect(out[1].run_id).toBe(DEMO_REPORT.run_id);
    expect(out[1].created_at).toBe("listed-at");
    expect(out[1].n_refined).toBe(3);
  });

  it("does not append a run the list doesn't hold", () => {
    expect(withReportSummary([OTHER], reviewedSample())).toEqual([OTHER]);
  });
});

// "Needs-review only" lists frames; the header and run list count near-dup groups.
// The sample's near-dup pair both await review, so the two differ by one, and the
// labels say which is which ("4 images" beside "3 groups to review").
describe("needsReviewFrames", () => {
  it("counts frames, not groups", () => {
    expect(needsReviewFrames(DEMO_REPORT.images)).toBe(5);
    expect(DEMO_REPORT.aggregate.n_needs_hitl).toBe(4);
  });

  it("drops the rated frame after a review is applied", () => {
    const updated = reviewedSample();
    expect(needsReviewFrames(updated.images)).toBe(4);
    expect(updated.aggregate.n_needs_hitl).toBe(3);
  });
});
