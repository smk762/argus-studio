import { describe, expect, it } from "vitest";

import { defaultFilters, type ImageResult, type SelectResult } from "@/components/curator/types";
import { capProblem, facetsNotSent, keptPaths, leftOutReasons, reasonKind, reasonLabel, selectBody } from "@/lib/curatorKeepSet";

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
    expect(selectBody(defaultFilters(), false)).toMatchObject({
      min_score: 0,
      keep_similar: false,
      face_clusters: null,
      face_poses: null,
      garments: null,
      min_scene_conf: 0.1,
      min_garment_conf: 0.5,
    });
  });

  it("sends only the facets that are on", () => {
    const body = selectBody({ ...defaultFilters(), minScore: 0.4, faceClusters: ["face_1"], poses: ["profile"] }, true);
    expect(body).toMatchObject({ min_score: 0.4, keep_similar: true, face_clusters: ["face_1"], face_poses: ["profile"] });
  });
});

describe("selectBody: readings", () => {
  it("sends the attribute, scene and garment facets", () => {
    const body = selectBody(
      {
        ...defaultFilters(),
        faceGenders: ["female"],
        faceAges: ["20-29"],
        faceRaces: ["white"],
        minAgeYears: 18,
        maxAgeYears: 40,
        scenes: ["bedroom"],
        sceneEnvironments: ["indoor"],
        garments: ["coat"],
        excludeGarments: ["hat"],
        garmentsUncropped: true,
      },
      false,
    );
    expect(body).toMatchObject({
      face_genders: ["female"],
      face_ages: ["20-29"],
      face_races: ["white"],
      min_age_years: 18,
      max_age_years: 40,
      scenes: ["bedroom"],
      scene_environments: ["indoor"],
      garments: ["coat"],
      exclude_garments: ["hat"],
      garments_uncropped: true,
    });
  });

  it("keeps the garment floor at what the scan recorded, or the curator refuses", () => {
    const summary = { garments_config: { enabled: true, min_conf: 0.6, device: "auto" } };
    expect(selectBody(defaultFilters(), false, summary).min_garment_conf).toBe(0.6);
  });
});

describe("selectBody: moderation", () => {
  const ran = {
    nsfw_config: { enabled: true },
    guard_config: { enabled: true, policy: "adult", variants: ["x"] },
  };

  it("sends a rule in full, never a letter", () => {
    const body = selectBody({ ...defaultFilters(), guardRules: ["B. Depicted Crime"], guardPolicies: ["x"] }, false, ran);
    expect(body).toMatchObject({ guard_unsafe: false, guard_rules: ["B. Depicted Crime"], guard_policies: ["x"] });
  });

  it("lets Drop every unsafe stand in for the rule list", () => {
    const body = selectBody({ ...defaultFilters(), guardUnsafe: true, guardRules: ["A. Risk"] }, false, ran);
    expect(body).toMatchObject({ guard_unsafe: true, guard_rules: null });
  });

  it("sends no policies unless a filter reads them", () => {
    expect(selectBody({ ...defaultFilters(), guardPolicies: ["x"] }, false, ran).guard_policies).toBeNull();
  });

  it("sends ratings", () => {
    expect(selectBody({ ...defaultFilters(), contentRatings: ["safe"] }, false, ran).content_ratings).toEqual(["safe"]);
  });

  it("leaves out filters the curator would refuse on a scan without the check", () => {
    const filters = { ...defaultFilters(), contentRatings: ["safe" as const], guardUnsafe: true, guardRules: ["A. Risk"] };
    expect(selectBody(filters, false, { nsfw_config: { enabled: false } })).toMatchObject({
      content_ratings: null,
      guard_unsafe: false,
      guard_rules: null,
      guard_policies: null,
    });
  });
});

describe("capProblem", () => {
  const cap = { max_keep: 10 };

  it("wants a whole number of at least one", () => {
    expect(capProblem({ max_keep: null }, true, 5, 5)).toMatch(/how many/);
    expect(capProblem({ max_keep: 0 }, true, 5, 5)).toMatch(/how many/);
    expect(capProblem({ max_keep: 2.5 }, true, 5, 5)).toMatch(/how many/);
  });

  it("wants a preview of this exact set", () => {
    expect(capProblem(cap, false, 5, 5)).toMatch(/Preview/);
  });

  it("refuses when the curator would export a frame this app holds", () => {
    expect(capProblem(cap, true, 5, 4)).toMatch(/holds/);
    expect(capProblem(cap, true, 5, 5)).toBeNull();
  });
});

describe("facetsNotSent", () => {
  it("names the facets the curator cannot apply", () => {
    expect(facetsNotSent(defaultFilters())).toEqual([]);
    expect(facetsNotSent({ ...defaultFilters(), singleFaceOnly: true, requireKnownFace: true })).toEqual([
      "Single-face only",
      "Require a known face",
    ]);
    expect(facetsNotSent({ ...defaultFilters(), guardView: "split" })).toEqual(["the verdict view"]);
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
    expect(reasonLabel("garment-new-rule")).toBe("Garment new rule");
    expect(reasonLabel("constructor")).toBe("Constructor");
    expect(reasonLabel("guard-unsafe:adult-granular")).toBe("Judged unsafe (adult-granular)");
    expect(reasonLabel("content-rating:explicit")).toBe("Rated explicit");
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
