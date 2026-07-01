import type { ImageResult } from "./types";

const BREAKDOWN_HINTS: Record<string, string> = {
  sharpness: "In-focus detail vs blur (higher is sharper).",
  resolution: "Pixels on the short edge vs your training target.",
  artifact: "Compression / banding penalty (higher is cleaner).",
  target_bonus: "Composition fit for the target category (framing, orientation, face count).",
  face_penalty: "Multiplier for wrong face count (identity wants exactly one face).",
};

export function breakdownTooltip(key: string): string {
  return BREAKDOWN_HINTS[key] ?? `Score component: ${key.replace(/_/g, " ")}.`;
}

/** Plain-language explanation of an image's status, for tooltips and the modal. */
export function statusExplanation(img: ImageResult): string {
  if (!img.passed) {
    return img.reject_reason
      ? `Rejected by hard filters: ${img.reject_reason}.`
      : "Did not pass hard filters (resolution, aspect, or blur).";
  }
  if (img.is_duplicate) {
    return img.duplicate_of
      ? `Near-duplicate of "${img.duplicate_of}" (pHash within threshold). The higher-scoring shot is the representative.`
      : "Near-duplicate; only the representative of each cluster is kept by default.";
  }
  if (img.group_size > 1) {
    return `Representative of a ${img.group_size}-image near-duplicate cluster.`;
  }
  return "Passed all hard filters and is a unique representative.";
}

export function formatScoreBreakdown(img: ImageResult): string {
  const entries = Object.entries(img.score_breakdown ?? {});
  if (entries.length === 0) return "No per-component breakdown for this image.";
  return entries.map(([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(3) : String(v)}`).join("\n");
}
