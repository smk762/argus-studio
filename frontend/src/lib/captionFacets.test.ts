import { describe, expect, it } from "vitest";

import type { BatchCaptionRow } from "@/types";
import {
  activeCount,
  bucketsOf,
  facetCounts,
  facetGroups,
  filterRows,
  groupLabel,
  hasBuckets,
  rowTerms,
  toggleTerm,
} from "@/lib/captionFacets";

// Rows as lens ≥ 0.11 returns them with include_buckets (metadata.buckets).
function row(rel_path: string, tags: Record<string, string[]>): BatchCaptionRow {
  return { rel_path, final_caption: rel_path, metadata: { buckets: { tags, prose: {} } } };
}

const ROWS = [
  row("a.jpg", { wardrobe: ["Red dress", "red dress "], lighting: ["golden hour"], unclassified: ["dog"] }),
  row("b.jpg", { wardrobe: ["jeans"], lighting: ["golden hour"] }),
  row("c.jpg", { wardrobe: ["red dress"], lighting: ["studio"], setting: [] }),
  { rel_path: "d.jpg", final_caption: "no buckets" },
];

describe("bucketsOf", () => {
  it("keeps string lists and drops anything else", () => {
    expect(bucketsOf({ buckets: { tags: { a: ["x", 3, "y"], b: "nope" }, prose: null } })).toEqual({
      tags: { a: ["x", "y"] },
      prose: undefined,
    });
  });

  it("is undefined without buckets", () => {
    expect(bucketsOf({})).toBeUndefined();
    expect(bucketsOf(null)).toBeUndefined();
    expect(bucketsOf({ buckets: "x" })).toBeUndefined();
  });
});

describe("rowTerms", () => {
  it("lower-cases, trims and de-duplicates", () => {
    expect(rowTerms(ROWS[0], "wardrobe")).toEqual(["red dress"]);
    expect(rowTerms(ROWS[3], "wardrobe")).toEqual([]);
  });
});

describe("hasBuckets / facetGroups", () => {
  it("needs at least one non-empty tag bucket", () => {
    expect(hasBuckets(ROWS)).toBe(true);
    expect(hasBuckets([ROWS[3], row("e", { setting: [] })])).toBe(false);
  });

  it("orders lens's categories first, unknown by name, unclassified last; empty buckets drop out", () => {
    const rows = [...ROWS, row("e", { zz_new: ["x"], aa_new: ["y"] })];
    expect(facetGroups(rows)).toEqual(["wardrobe", "lighting", "aa_new", "zz_new", "unclassified"]);
  });

  it("labels unclassified and unknown categories", () => {
    expect(groupLabel("unclassified")).toBe("Other tags");
    expect(groupLabel("camera_framing_x")).toBe("Camera Framing X");
  });
});

describe("filterRows", () => {
  it("ORs terms within a category and ANDs across categories", () => {
    const either = { wardrobe: ["red dress", "jeans"] };
    expect(filterRows(ROWS, either).map((r) => r.rel_path)).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
    const both = { wardrobe: ["red dress"], lighting: ["golden hour"] };
    expect(filterRows(ROWS, both).map((r) => r.rel_path)).toEqual(["a.jpg"]);
  });

  it("passes every row with no selection", () => {
    expect(filterRows(ROWS, {})).toHaveLength(4);
  });
});

describe("facetCounts", () => {
  it("counts a category under the other categories' selection only", () => {
    const sel = { wardrobe: ["jeans"] };
    // Wardrobe ignores its own selection, so its siblings keep their counts.
    expect(facetCounts(ROWS, "wardrobe", sel)).toEqual([
      { term: "red dress", count: 2, selected: false },
      { term: "jeans", count: 1, selected: true },
    ]);
    // Lighting is narrowed by the wardrobe pick.
    expect(facetCounts(ROWS, "lighting", sel)).toEqual([{ term: "golden hour", count: 1, selected: false }]);
  });

  it("keeps a selected term listed at zero", () => {
    const sel = { wardrobe: ["jeans"], lighting: ["studio"] };
    expect(facetCounts(ROWS, "lighting", sel)).toContainEqual({ term: "studio", count: 0, selected: true });
  });
});

describe("toggleTerm / activeCount", () => {
  it("adds, removes and drops an emptied category", () => {
    let sel = toggleTerm({}, "wardrobe", "jeans");
    sel = toggleTerm(sel, "lighting", "studio");
    expect(activeCount(sel)).toBe(2);
    sel = toggleTerm(sel, "wardrobe", "jeans");
    expect(sel).toEqual({ lighting: ["studio"] });
  });
});
