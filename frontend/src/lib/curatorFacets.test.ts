import { describe, expect, it } from "vitest";

import { defaultFilters, type CuratorFilters, type ImageResult } from "@/components/curator/types";
import { facetCounts, matchesFilters, rankedLabels, slugLabel } from "@/lib/curatorFacets";

const row = (extra: Partial<ImageResult> = {}): ImageResult =>
  ({ rel_path: "a.jpg", score: 0.9, passed: true, is_duplicate: false, face_count: 1, faces: [], ...extra }) as ImageResult;
const filters = (patch: Partial<CuratorFilters>): CuratorFilters => ({ ...defaultFilters(), ...patch });
const garment = (label: string, conf: number, touches_edge = false) => ({ label, conf, bbox: [0, 0, 1, 1] as [number, number, number, number], touches_edge });
const scene = { environment: "indoor" as const, environment_conf: 0.8, categories: [{ label: "bedroom", conf: 0.5 }, { label: "attic", conf: 0.05 }] };

describe("matchesFilters: attributes", () => {
  const img = row({ primary_face_attributes: { gender: "female", gender_conf: 0.7, age: "20-29", age_years: 24, race: "white", race_conf: 0.4 } });

  it("passes everything with no facet on", () => {
    expect(matchesFilters(row(), defaultFilters())).toBe(true);
  });

  it("drops a frame with no reading once a facet is on", () => {
    expect(matchesFilters(row(), filters({ faceGenders: ["female"] }))).toBe(false);
    expect(matchesFilters(row(), filters({ minAgeYears: 18 }))).toBe(false);
  });

  it("matches the label and holds it to the confidence floor", () => {
    expect(matchesFilters(img, filters({ faceGenders: ["female"] }))).toBe(true);
    expect(matchesFilters(img, filters({ faceGenders: ["male"] }))).toBe(false);
    expect(matchesFilters(img, filters({ faceRaces: ["white"], minAttributeConf: 0.5 }))).toBe(false);
  });

  it("holds a regression age to no floor, as its confidence is null", () => {
    const mivolo = row({ primary_face_attributes: { age: "20-29", age_conf: null, age_years: 24 } });
    expect(matchesFilters(mivolo, filters({ faceAges: ["20-29"], minAttributeConf: 0.9 }))).toBe(true);
  });

  it("treats the year range as inclusive", () => {
    expect(matchesFilters(img, filters({ minAgeYears: 24, maxAgeYears: 24 }))).toBe(true);
    expect(matchesFilters(img, filters({ maxAgeYears: 23 }))).toBe(false);
  });
});

describe("matchesFilters: scenes", () => {
  it("drops an untagged frame", () => {
    expect(matchesFilters(row(), filters({ sceneEnvironments: ["indoor"] }))).toBe(false);
  });

  it("applies the floor to labels and the environment", () => {
    const img = row({ scene });
    expect(matchesFilters(img, filters({ scenes: ["bedroom"] }))).toBe(true);
    expect(matchesFilters(img, filters({ scenes: ["attic"] }))).toBe(false);
    expect(matchesFilters(img, filters({ sceneEnvironments: ["indoor"], minSceneConf: 0.9 }))).toBe(false);
    expect(matchesFilters(img, filters({ sceneEnvironments: ["outdoor"] }))).toBe(false);
  });
});

describe("matchesFilters: garments", () => {
  it("reads null as not run, unlike an empty list", () => {
    expect(matchesFilters(row({ garments: null }), filters({ excludeGarments: ["hat"] }))).toBe(false);
    expect(matchesFilters(row({ garments: [] }), filters({ excludeGarments: ["hat"] }))).toBe(true);
  });

  it("counts only detections at the floor", () => {
    const img = row({ garments: [garment("hat", 0.4), garment("coat", 0.9)] });
    expect(matchesFilters(img, filters({ garments: ["hat"] }))).toBe(false);
    expect(matchesFilters(img, filters({ excludeGarments: ["hat"] }))).toBe(true);
    expect(matchesFilters(img, filters({ excludeGarments: ["coat"] }))).toBe(false);
  });

  it("wants one match clear of the edge when asked", () => {
    const cut = row({ garments: [garment("coat", 0.9, true)] });
    const both = row({ garments: [garment("coat", 0.9, true), garment("coat", 0.8)] });
    expect(matchesFilters(cut, filters({ garments: ["coat"], garmentsUncropped: true }))).toBe(false);
    expect(matchesFilters(both, filters({ garments: ["coat"], garmentsUncropped: true }))).toBe(true);
  });
});

describe("matchesFilters: moderation", () => {
  it("drops an unrated frame once a rating is on", () => {
    expect(matchesFilters(row({ content_rating: "safe" }), filters({ contentRatings: ["safe"] }))).toBe(true);
    expect(matchesFilters(row({ content_rating: "explicit" }), filters({ contentRatings: ["safe"] }))).toBe(false);
    expect(matchesFilters(row({ content_rating: null }), filters({ contentRatings: ["safe"] }))).toBe(false);
  });

  it("applies the verdict filters and the view", () => {
    const flagged = row({ guard: { safe: false, rules: ["A. Risk"] } });
    expect(matchesFilters(flagged, filters({ guardUnsafe: true }))).toBe(false);
    expect(matchesFilters(flagged, filters({ guardView: "unsafe" }))).toBe(true);
    expect(matchesFilters(flagged, filters({ guardView: "safe" }))).toBe(false);
  });
});

describe("facetCounts", () => {
  it("counts a frame once per label, at the floors", () => {
    const counts = facetCounts(
      [
        row({
          primary_face_attributes: { gender: "male", age_years: 30 },
          scene,
          garments: [garment("coat", 0.9), garment("coat", 0.8), garment("hat", 0.2)],
        }),
        row(),
      ],
      0.1,
      0.5,
    );
    expect(counts.genders.get("male")).toBe(1);
    expect(counts.yearsKnown).toBe(1);
    expect([...counts.scenes]).toEqual([["bedroom", 1]]);
    expect(counts.environments.get("indoor")).toBe(1);
    expect([...counts.garments]).toEqual([["coat", 1]]);
  });
});

describe("rankedLabels", () => {
  it("orders by count and keeps what is ticked", () => {
    expect(rankedLabels(new Map([["a", 1], ["b", 3]]), ["z"])).toEqual(["b", "a", "z"]);
  });
});

describe("slugLabel", () => {
  it("reads like words", () => {
    expect(slugLabel("east_asian")).toBe("East asian");
    expect(slugLabel("0-2")).toBe("0 2");
  });
});
