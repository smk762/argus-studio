import { describe, expect, it } from "vitest";

import { refineOf, refineOutcome, type RefineRecord } from "@/lib/captionRefine";

const record = (overrides: Partial<RefineRecord> = {}): RefineRecord => ({
  rewriter: "openai-compat",
  model: "qwen3:8b",
  accepted: [],
  rejected: {},
  attempts: 1,
  error: null,
  skipped: null,
  ...overrides,
});

describe("refineOf", () => {
  it("reads lens's record", () => {
    const refine = {
      rewriter: "openai-compat",
      model: "qwen3:8b",
      accepted: ["training"],
      rejected: { wardrobe: ["invented: hat"] },
      attempts: 2,
    };
    expect(refineOf({ refine })).toEqual(
      record({ accepted: ["training"], rejected: { wardrobe: ["invented: hat"] }, attempts: 2 }),
    );
  });

  it("reads a skipped record, which has no attempts", () => {
    const next = refineOf({ refine: { rewriter: "r", model: "m", skipped: "unavailable" } });
    expect(next?.skipped).toBe("unavailable");
    expect(next?.attempts).toBeNull();
    expect(next?.accepted).toEqual([]);
  });

  it("treats anything else as no record", () => {
    expect(refineOf(undefined)).toBeNull();
    expect(refineOf({})).toBeNull();
    expect(refineOf({ refine: "yes" })).toBeNull();
    expect(refineOf({ refine: [] })).toBeNull();
  });

  it("drops malformed fields rather than throwing", () => {
    const next = refineOf({ refine: { accepted: "training", rejected: { a: "nope", b: [1, "ok"] }, attempts: "2" } });
    expect(next).toEqual(record({ rewriter: "", model: "", rejected: { a: [], b: ["ok"] }, attempts: null }));
  });
});

describe("refineOutcome", () => {
  it("tells the outcomes apart", () => {
    expect(refineOutcome(record({ accepted: ["training"] }))).toBe("refined");
    expect(refineOutcome(record({ accepted: ["training"], rejected: { setting: ["x"] } }))).toBe("partial");
    expect(refineOutcome(record({ accepted: ["training"], error: "boom" }))).toBe("partial");
    expect(refineOutcome(record({ rejected: { setting: ["x"] } }))).toBe("failed");
    expect(refineOutcome(record({ error: "ConnectError: refused" }))).toBe("failed");
    expect(refineOutcome(record({ skipped: "unavailable" }))).toBe("skipped");
    expect(refineOutcome(record())).toBe("unchanged");
  });
});
