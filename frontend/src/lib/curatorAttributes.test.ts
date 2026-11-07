import { describe, expect, it } from "vitest";

import type { ImageResult } from "@/components/curator/types";
import {
  attributeLine,
  bodyAgeLines,
  cardAge,
  checkWarnings,
  garmentRows,
  sceneRows,
  setAgeOutcome,
} from "@/lib/curatorAttributes";

const row = (extra: Partial<ImageResult>) => ({ rel_path: "a", ...extra }) as ImageResult;

describe("attributeLine", () => {
  it("keeps each reading's source in view", () => {
    expect(attributeLine({ gender: "female", gender_source: "mivolo", age_years: 24.4, age_source: "mivolo", age_body: true })).toBe(
      "female (mivolo) · 24y (mivolo, with body)",
    );
  });

  it("falls back to the bracket", () => {
    expect(attributeLine({ age: "20-29", age_source: "fairface", race: "east_asian", race_conf: 0.61 })).toBe(
      "East asian 61% · 20-29 (fairface)",
    );
  });

  it("is null with nothing to say", () => {
    expect(attributeLine(null)).toBeNull();
    expect(attributeLine({})).toBeNull();
  });
});

describe("cardAge", () => {
  it("prefers the measured age, and marks an inferred one", () => {
    expect(cardAge(row({ primary_face_attributes: { age_years: 31 }, set_age: { years: 25 } }))).toBe("31y");
    expect(cardAge(row({ set_age: { years: 25 } }))).toBe("≈25y set");
    expect(cardAge(row({}))).toBeNull();
  });
});

describe("bodyAgeLines", () => {
  it("lists only people with no matched face", () => {
    const img = row({ people: [{ face_index: 0, age_years: 30 }, { face_index: null, age_years: 22 }, { face_index: null }] });
    expect(bodyAgeLines(img)).toEqual(["22y (body only)"]);
  });
});

describe("checkWarnings", () => {
  it("says no face means unchecked after a failed detection", () => {
    expect(checkWarnings(row({ face_error: "bad decode" }))[0]).toMatch(/unchecked: bad decode/);
  });

  it("tells the two person failures apart", () => {
    expect(checkWarnings(row({ people_check: "detection_failed" }))[0]).toMatch(/person detector failed/);
    expect(checkWarnings(row({ people_check: "body_ages_failed", people_error: "x" }))[0]).toMatch(/body ages failed: x/);
  });

  it("is quiet when the check went fine", () => {
    expect(checkWarnings(row({ people_check: "ok" }))).toEqual([]);
  });
});

describe("rows", () => {
  it("lists scenes and garments as text", () => {
    expect(sceneRows({ environment: "outdoor", environment_conf: 0.9, categories: [{ label: "sky_high", conf: 0.4 }] })).toEqual([
      ["Environment", "outdoor 90%"],
      ["Sky high", "40%"],
    ]);
    expect(garmentRows([{ label: "shirt_blouse", conf: 0.8, bbox: [0, 0, 1, 1], touches_edge: true }])).toEqual([
      ["Shirt blouse", "80%, cut off"],
    ]);
    expect(sceneRows(null)).toEqual([]);
    expect(garmentRows(null)).toEqual([]);
  });
});

describe("setAgeOutcome", () => {
  it("says what the set age came from and where it went", () => {
    const summary = { set_age: { years: 27, faces: 12, cluster_id: "face_1", share: 0.95 }, results: [row({ set_age: { years: 27 } }), row({})] };
    expect(setAgeOutcome(summary)).toBe("Set age ≈27y from 12 faces in face_1 (95%), on 1 frame with no face.");
  });

  it("says why there is none, and nothing when not asked", () => {
    expect(setAgeOutcome({ set_age_skipped: "mixed folder", results: [] })).toBe("No set age: mixed folder.");
    expect(setAgeOutcome({ results: [] })).toBeNull();
  });
});
