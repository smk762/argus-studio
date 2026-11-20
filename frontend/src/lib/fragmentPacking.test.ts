import { describe, expect, it } from "vitest";

import { packFragments } from "./fragmentPacking";

const FRAGMENTS = [
  { name: "identity", tokens: 18 },
  { name: "wardrobe", tokens: 22 },
  { name: "pose", tokens: 20 },
  { name: "setting", tokens: 34 },
  { name: "lighting", tokens: 26 },
  { name: "prose", tokens: 40 },
];

describe("packFragments", () => {
  it("skips a fragment that does not fit and keeps a smaller later one", () => {
    const rows = packFragments(FRAGMENTS, 90);
    // Not a lowest-priority tail: setting is dropped while lighting after it fits.
    expect(rows.filter((r) => !r.fits).map((r) => r.name)).toEqual(["setting", "prose"]);
  });

  it("keeps everything when the budget covers it", () => {
    expect(packFragments(FRAGMENTS, 160).every((r) => r.fits)).toBe(true);
  });
});
