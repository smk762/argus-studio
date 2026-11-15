import { describe, expect, it } from "vitest";

import { finalChoice, resultToCSV, resultToJSON, withFinal } from "@/lib/captionFinal";
import type { CaptionResult } from "@/types";

const lens: CaptionResult = {
  final_caption: "a woman, red hair",
  caption_variants: {
    identity: "a woman, red hair",
    zeroshot: 'pier at "dusk", wide shot',
    wardrobe: "",
    lighting: "   ",
  },
  selected_category: "identity",
  removed_phrases: ["blurry"],
  compaction_notes: ["note"],
  raw_tags: "woman, red_hair",
  raw_prose: "A woman on a pier.",
  backend_name: "hybrid",
  metadata: {},
};

const csvRows = (csv: string) => csv.trimEnd().split("\n");

describe("finalChoice", () => {
  it("keeps another variant", () => {
    expect(finalChoice(lens, "zeroshot")).toBe("zeroshot");
  });

  it("treats lens's own pick as no choice", () => {
    expect(finalChoice(lens, "identity")).toBeNull();
  });

  it("refuses an empty, blank or missing variant", () => {
    for (const variant of ["wardrobe", "lighting", "gone", null]) expect(finalChoice(lens, variant)).toBeNull();
  });
});

describe("withFinal", () => {
  it("moves the final caption and the category together", () => {
    const final = withFinal(lens, "zeroshot");
    expect(final.final_caption).toBe(lens.caption_variants.zeroshot);
    expect(final.selected_category).toBe("zeroshot");
  });

  it("does not change lens's result", () => {
    const before = structuredClone(lens);
    withFinal(lens, "zeroshot");
    expect(lens).toEqual(before);
  });

  it("returns lens's result as it is without a choice", () => {
    expect(withFinal(lens, null)).toBe(lens);
    expect(withFinal(lens, "wardrobe")).toBe(lens);
  });
});

describe("resultToJSON", () => {
  it("exports the chosen text and names lens's pick", () => {
    const data = JSON.parse(resultToJSON(lens, "http://x/a.jpg", "zeroshot"));
    expect(data.image_url).toBe("http://x/a.jpg");
    expect(data.final_caption).toBe(lens.caption_variants.zeroshot);
    expect(data.selected_category).toBe("zeroshot");
    expect(data.final_choice).toEqual({
      variant: "zeroshot",
      lens_selected_category: "identity",
      lens_final_caption: "a woman, red hair",
    });
  });

  it("is lens's result plus the image without a choice", () => {
    expect(JSON.parse(resultToJSON(lens, "u", null))).toEqual({ image_url: "u", ...lens });
  });
});

describe("resultToCSV", () => {
  it("puts the chosen text on the __final row", () => {
    const [, final] = csvRows(resultToCSV(lens, "u", "zeroshot"));
    expect(final).toBe('u,__final,"pier at ""dusk"", wide shot",hybrid,zeroshot,"woman, red_hair",A woman on a pier.,blurry,note,identity,"a woman, red hair"');
  });

  it("marks every variant row with the same category", () => {
    const rows = csvRows(resultToCSV(lens, "u", "zeroshot")).slice(2);
    expect(rows).toHaveLength(Object.keys(lens.caption_variants).length);
    expect(rows[0]).toBe('u,identity,"a woman, red hair",hybrid,zeroshot,,,,,identity,');
  });

  it("is lens's pick without a choice", () => {
    const [header, final] = csvRows(resultToCSV(lens, "u", null));
    expect(header).toBe("image_url,variant,caption,backend,selected_category,raw_tags,raw_prose,removed_phrases,compaction_notes,lens_selected_category,lens_final_caption");
    expect(final).toBe('u,__final,"a woman, red hair",hybrid,identity,"woman, red_hair",A woman on a pier.,blurry,note,identity,"a woman, red hair"');
  });
});

// Audit: CSV/formula injection and bare CR (pack-argus-studio-37227a5ab0, -6f1550e3cf).
import { escapeCSV } from "@/lib/captionFinal";

describe("escapeCSV", () => {
  it.each(["=HYPERLINK(\"x\")", "+1", "-2+3", "@SUM(A1)", "\tx", "\rx"])("neutralises a formula-leading cell %j", (v) => {
    const out = escapeCSV(v);
    expect(out.startsWith(`"'`)).toBe(true);
  });

  it("quotes a value with a bare carriage return", () => {
    expect(escapeCSV("a\rb")).toBe('"a\rb"');
  });

  it("leaves a plain value alone and still quotes commas and quotes", () => {
    expect(escapeCSV("a woman in a coat")).toBe("a woman in a coat");
    expect(escapeCSV('a, "b"')).toBe('"a, ""b"""');
  });
});
