/**
 * The keep set: what a filter would keep, asked of the curator
 * (`POST /scan/{id}/select`) before anything is written.
 *
 * An export that names a `selection` ignores every filter on the request, so a
 * filter reaches the curator here. The rows it keeps then become the selection.
 * The curator's under-18 rule is narrower than {@link canExport}, so what it
 * keeps is checked against that before it can be selected.
 */

import type {
  CuratorFilters,
  ImageResult,
  SelectRequest,
  SelectResult,
} from "@/components/curator/types";
import { canExport } from "@/lib/curatorSafety";

/**
 * The facets the curator can apply. Near-duplicates are a separate choice, since
 * the rail's toggle only hides them. `min_score` is always sent because the
 * curator's own default is 0.6.
 */
export function selectBody(filters: CuratorFilters, keepSimilar: boolean): SelectRequest {
  return {
    min_score: filters.minScore,
    keep_similar: keepSimilar,
    face_clusters: filters.faceClusters.length > 0 ? [...filters.faceClusters] : null,
    face_poses: filters.poses.length > 0 ? [...filters.poses] : null,
  };
}

/** Facets on now that the curator has no field for, so a preview leaves them out. */
export function facetsNotSent(filters: CuratorFilters): string[] {
  const out: string[] = [];
  if (filters.singleFaceOnly) out.push("Single-face only");
  if (filters.requireKnownFace) out.push("Require a known face");
  return out;
}

const REASON_LABELS: Record<string, string> = {
  "below-score": "Below the minimum score",
  "similar-to": "Near-duplicate of a kept frame",
  "not-selected": "Not selected",
  "minor-exposed": "Under 18 with exposure",
  rejected: "Rejected",
  "face-cluster-excluded": "Other identity",
  "face-pose-excluded": "Other head pose",
  "prefilter:nsfw": "Prefilter: exposed",
  "prefilter:no-face": "Prefilter: no face",
  "prefilter:no-age": "Prefilter: no age",
  "crop:overlay": "Watermark over the image",
  "crop:unchecked": "Watermark check failed",
  "crop:invalid": "Crop box outside the frame",
  "crop:unreadable": "Crop box unreadable",
  "crop:failed": "Crop failed",
};

/** A reason without the detail that differs frame by frame: the named file, or a bracket. */
export function reasonKind(reason: string): string {
  if (reason.startsWith("similar-to:")) return "similar-to";
  return reason.split("(")[0].trim();
}

/** A readable name for a `keep_reason` or `reject_reason`, including one newer than this client. */
export function reasonLabel(reason: string): string {
  const kind = reasonKind(reason);
  if (Object.hasOwn(REASON_LABELS, kind)) return REASON_LABELS[kind];
  const words = kind.replace(/[-_:]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Left out";
}

export interface ReasonCount {
  reason: string;
  label: string;
  count: number;
}

/** Why rows were left out, most common first. */
export function leftOutReasons(result: SelectResult): ReasonCount[] {
  const counts = new Map<string, number>();
  for (const row of result.rows) {
    if (!row.keep_reason) continue;
    const kind = reasonKind(row.keep_reason);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, label: reasonLabel(reason), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * The rel paths this result can select. A row the page no longer has, or one
 * {@link canExport} holds, stays out whatever the curator said.
 */
export function keptPaths(result: SelectResult, rows: readonly ImageResult[]): string[] {
  const byPath = new Map(rows.map((row) => [row.rel_path, row]));
  return result.rows.flatMap((row) => {
    if (row.keep_reason) return [];
    const img = byPath.get(row.rel_path);
    return img && canExport(img) ? [row.rel_path] : [];
  });
}
