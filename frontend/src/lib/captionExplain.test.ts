import { describe, expect, it } from "vitest";

import { bucketCategories, bucketsOf, splitTags, traceVariant, type CaptionBuckets } from "@/lib/captionExplain";
import type { CaptionResult } from "@/types";

const buckets: CaptionBuckets = {
  tags: { wardrobe: ["red_coat", "red"], setting: [], unclassified: ["mystery"] },
  prose: { setting: ["a city street"], unclassified: [] },
};

function caption(overrides: Partial<CaptionResult> = {}): CaptionResult {
  return {
    final_caption: "",
    caption_variants: { wardrobe: "a Red Coat on a bored woman" },
    selected_category: "wardrobe",
    removed_phrases: [],
    compaction_notes: [],
    raw_tags: "1girl, red_coat, red, mystery, 1girl",
    raw_prose: "",
    backend_name: "stub",
    metadata: {},
    ...overrides,
  };
}

describe("bucketsOf", () => {
  it("reads lens's buckets", () => {
    expect(bucketsOf({ buckets })).toEqual(buckets);
  });

  it("has nothing to explain without buckets, or with empty ones", () => {
    expect(bucketsOf(undefined)).toBeNull();
    expect(bucketsOf({})).toBeNull();
    expect(bucketsOf({ buckets: "no" })).toBeNull();
    expect(bucketsOf({ buckets: { tags: { wardrobe: [] }, prose: {} } })).toBeNull();
  });

  it("drops malformed entries rather than throwing", () => {
    const raw = { buckets: { tags: { wardrobe: ["coat", 1], setting: "street" }, prose: null } };
    expect(bucketsOf(raw)).toEqual({ tags: { wardrobe: ["coat"] }, prose: {} });
  });
});

describe("splitTags", () => {
  it("normalizes booru tags and drops blanks", () => {
    expect(splitTags("Red_Coat, , city street")).toEqual(["red coat", "city street"]);
  });
});

describe("bucketCategories", () => {
  it("keeps categories with something in them, and puts unclassified last", () => {
    const unordered = { tags: { unclassified: ["x"], wardrobe: ["y"] }, prose: { setting: ["z"], lighting: [] } };
    expect(bucketCategories(unordered)).toEqual(["wardrobe", "setting", "unclassified"]);
  });
});

describe("traceVariant", () => {
  const kept = (variant: string, result = caption()) =>
    Object.fromEntries(traceVariant(result, buckets, variant).fragments.map((f) => [f.text, f.kept]));

  it("marks what reached the variant, ignoring case and underscores", () => {
    expect(kept("wardrobe")).toMatchObject({ red_coat: true, mystery: false, "a city street": false });
  });

  it("matches whole words only", () => {
    const result = caption({ caption_variants: { wardrobe: "a bored woman" } });
    expect(kept("wardrobe", result).red).toBe(false);
  });

  it("marks everything trimmed for a variant that isn't there", () => {
    expect(Object.values(kept("nope")).every((value) => !value)).toBe(true);
  });

  it("lists raw tags that reached no category, once each", () => {
    expect(traceVariant(caption(), buckets, "wardrobe").stripped).toEqual(["1girl"]);
  });
});
