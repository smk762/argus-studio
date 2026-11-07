import { describe, expect, it } from "vitest";

import type { ImageResult } from "@/components/curator/types";
import { contentRating, eraxRows, nudenetRows, ratingCounts, scoreSource, sortResults } from "@/lib/curatorModeration";

const row = (rel_path: string, extra: Partial<ImageResult> = {}) =>
  ({ rel_path, score: 0.5, passed: true, nsfw: null, ...extra }) as ImageResult;
const scored = (score: number, labels: Record<string, number> = {}) => ({ exposed_score: score, labels });

describe("contentRating", () => {
  it("takes the curator's rating, and its null", () => {
    expect(contentRating(row("a", { content_rating: "explicit" }))).toBe("explicit");
    expect(contentRating(row("a", { content_rating: null, nsfw: scored(0.9) }))).toBeNull();
  });

  it("reads nsfw the same way for a curator older than the field", () => {
    expect(contentRating(row("a", { nsfw: scored(0.2) }))).toBe("explicit");
    expect(contentRating(row("a", { nsfw: scored(0, { BUTTOCKS_COVERED: 0.3 }) }))).toBe("suggestive");
    expect(contentRating(row("a", { nsfw: scored(0) }))).toBe("safe");
  });

  it("never rates an unscored frame", () => {
    expect(contentRating(row("a"))).toBeNull();
  });
});

describe("ratingCounts", () => {
  it("keeps unscored frames out of safe", () => {
    expect(ratingCounts([row("a"), row("b", { nsfw: scored(0) })])).toEqual({ safe: 1, suggestive: 0, explicit: 0, unchecked: 1 });
  });
});

describe("sortResults", () => {
  const rows = [row("none"), row("low", { nsfw: scored(0), score: 0.9 }), row("high", { nsfw: scored(0.8) })];

  it("puts an unscored frame after the ones NudeNet cleared", () => {
    expect(sortResults(rows, "exposed").map((r) => r.rel_path)).toEqual(["high", "low", "none"]);
  });

  it("leaves scan order alone and does not mutate the input", () => {
    expect(sortResults(rows, "scan")).toBe(rows);
    sortResults(rows, "score");
    expect(rows[0].rel_path).toBe("none");
  });

  it("sorts by score", () => {
    expect(sortResults(rows, "score")[0].rel_path).toBe("low");
  });
});

describe("readings", () => {
  it("names where the score came from", () => {
    expect(scoreSource(row("a", { nudenet_failed: true }))).toMatch(/EraX alone/);
    expect(scoreSource(row("a", { erax_filled: true }))).toMatch(/filled in/);
    expect(scoreSource(row("a"))).toBeNull();
  });

  it("lists classes highest first, and nothing for an unscored frame", () => {
    const img = row("a", { nsfw: scored(0.6, { FEMALE_BREAST_EXPOSED: 0.6, BELLY_EXPOSED: 0.9 }) });
    expect(nudenetRows(img)).toEqual([
      ["Exposed score", "0.60"],
      ["Belly exposed", "0.90"],
      ["Female breast exposed", "0.60"],
    ]);
    expect(nudenetRows(row("a"))).toBeNull();
  });

  it("tells EraX not run from EraX found nothing", () => {
    expect(eraxRows(row("a"))).toBeNull();
    expect(eraxRows(row("a", { erax: { labels: {} } }))).toEqual([]);
  });
});
