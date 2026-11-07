import { describe, expect, it } from "vitest";

import { defaultFilters, type ImageResult, type SelectResult } from "@/components/curator/types";
import { facetsNotSent, keptPaths, leftOutReasons, reasonKind, reasonLabel, selectBody } from "@/lib/curatorKeepSet";

const row = (rel_path: string, extra: Partial<ImageResult> = {}): ImageResult =>
  ({ rel_path, passed: true, faces: [], nsfw: null, ...extra }) as ImageResult;

const result = (rows: [string, string][]): SelectResult => ({
  scan_id: "s",
  total: rows.length,
  kept: rows.filter(([, reason]) => reason === "").length,
  rows: rows.map(([rel_path, keep_reason]) => ({ rel_path, abs_path: `/d/${rel_path}`, keep_reason })),
});

describe("selectBody", () => {
  it("always sends a score, since the curator's own default is 0.6", () => {
    expect(selectBody(defaultFilters(), false)).toEqual({
      min_score: 0,
      keep_similar: false,
      face_clusters: null,
      face_poses: null,
    });
  });

  it("sends only the facets that are on", () => {
    const body = selectBody({ ...defaultFilters(), minScore: 0.4, faceClusters: ["face_1"], poses: ["profile"] }, true);
    expect(body).toMatchObject({ min_score: 0.4, keep_similar: true, face_clusters: ["face_1"], face_poses: ["profile"] });
  });
});

describe("facetsNotSent", () => {
  it("names the facets the curator cannot apply", () => {
    expect(facetsNotSent(defaultFilters())).toEqual([]);
    expect(facetsNotSent({ ...defaultFilters(), singleFaceOnly: true, requireKnownFace: true })).toEqual([
      "Single-face only",
      "Require a known face",
    ]);
  });
});

describe("reasons", () => {
  it("drops the detail that differs frame by frame", () => {
    expect(reasonKind("similar-to:a/b.jpg")).toBe("similar-to");
    expect(reasonKind("crop:unchecked (timed out)")).toBe("crop:unchecked");
    expect(reasonKind("blurry (32.1 < 100)")).toBe("blurry");
  });

  it("labels known reasons and keeps a newer one readable", () => {
    expect(reasonLabel("prefilter:no-age")).toBe("Prefilter: no age");
    expect(reasonLabel("crop:overlay")).toBe("Watermark over the image");
    expect(reasonLabel("garment-cropped")).toBe("Garment cropped");
    expect(reasonLabel("constructor")).toBe("Constructor");
  });

  it("tallies what was left out, most common first", () => {
    const tally = leftOutReasons(
      result([
        ["a", ""],
        ["b", "below-score"],
        ["c", "similar-to:x"],
        ["d", "similar-to:y"],
      ]),
    );
    expect(tally.map((entry) => [entry.reason, entry.count])).toEqual([
      ["similar-to", 2],
      ["below-score", 1],
    ]);
  });
});

describe("keptPaths", () => {
  it("keeps only what the curator kept", () => {
    expect(keptPaths(result([["a", ""], ["b", "below-score"]]), [row("a"), row("b")])).toEqual(["a"]);
  });

  it("holds a frame the curator kept but this app will not select", () => {
    const minorExposed = row("held", {
      faces: [{ attributes: { age_years: 15, age_source: "mivolo" } }] as ImageResult["faces"],
      nsfw: { exposed_score: 0.3, labels: {} },
    });
    expect(keptPaths(result([["held", ""]]), [minorExposed])).toEqual([]);
    expect(keptPaths(result([["gone", ""]]), [])).toEqual([]);
    expect(keptPaths(result([["bad", ""]]), [row("bad", { passed: false })])).toEqual([]);
  });
});
