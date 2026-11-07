/**
 * NudeNet and EraX readings, for the facets, the sort and the detail view.
 * `nsfw: null` is "not scored", never clear: it has no rating, no sort value, and
 * its own line in a count.
 */

import type { ContentRating, ImageResult } from "@/components/curator/types";
import { exposedReading, MINOR_EXPOSED_SCORE } from "@/lib/curatorSafety";

/** Matches the curator's SUGGESTIVE_LABELS. */
const SUGGESTIVE_LABELS = ["FEMALE_BREAST_COVERED", "FEMALE_GENITALIA_COVERED", "BUTTOCKS_COVERED", "ANUS_COVERED"];

/** The curator's `content_rating`, else the same reading of `nsfw` for a curator older than the field. */
export function contentRating(img: ImageResult): ContentRating | null {
  if (img.content_rating !== undefined) return img.content_rating;
  if (img.nsfw == null) return null;
  if (exposedReading(img) >= MINOR_EXPOSED_SCORE) return "explicit";
  const labels = img.nsfw.labels ?? {};
  return SUGGESTIVE_LABELS.some((label) => (labels[label] ?? 0) >= MINOR_EXPOSED_SCORE) ? "suggestive" : "safe";
}

export function ratingCounts(results: readonly ImageResult[]): Record<ContentRating | "unchecked", number> {
  const counts = { safe: 0, suggestive: 0, explicit: 0, unchecked: 0 };
  for (const img of results) counts[contentRating(img) ?? "unchecked"] += 1;
  return counts;
}

export type ResultSort = "scan" | "score" | "exposed";

/**
 * Rows in the chosen order. `Array.prototype.sort` is stable, so ties keep scan
 * order. Under `exposed`, a frame with no reading goes last: it is unknown,
 * and sorting it as 0 would file it with the frames NudeNet cleared.
 */
export function sortResults(rows: ImageResult[], sort: ResultSort): ImageResult[] {
  if (sort === "scan") return rows;
  if (sort === "score") return [...rows].sort((a, b) => b.score - a.score);
  const reading = (img: ImageResult) => (img.nsfw == null ? -1 : exposedReading(img));
  return [...rows].sort((a, b) => reading(b) - reading(a));
}

/** Where the frame's `nsfw` came from, when that is not simply NudeNet. */
export function scoreSource(img: ImageResult): string | null {
  if (img.nudenet_failed) return "NudeNet failed, so this is EraX alone, which has no buttocks class.";
  if (img.erax_filled) return "NudeNet found nothing here, so EraX filled in.";
  return null;
}

function labelRows(labels: Record<string, number> | null | undefined): [string, string][] {
  const readable = (label: string) => {
    const words = label.toLowerCase().replace(/_/g, " ");
    return words[0].toUpperCase() + words.slice(1);
  };
  return Object.entries(labels ?? {})
    .sort(([, a], [, b]) => b - a)
    .map(([label, score]) => [readable(label), score.toFixed(2)]);
}

/** NudeNet's classes, highest first. Null when the frame was not scored. */
export function nudenetRows(img: ImageResult): [string, string][] | null {
  if (img.nsfw == null) return null;
  return [["Exposed score", exposedReading(img).toFixed(2)], ...labelRows(img.nsfw.labels)];
}

/** EraX's own classes, highest first. Null when it did not run. */
export function eraxRows(img: ImageResult): [string, string][] | null {
  return img.erax == null ? null : labelRows(img.erax.labels);
}
