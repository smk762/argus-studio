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
  CapOptions,
  CuratorFilters,
  ImageResult,
  ScanSummary,
  SelectRequest,
  SelectResult,
} from "@/components/curator/types";
import { canExport } from "@/lib/curatorSafety";

/**
 * The facets the curator can apply. Near-duplicates are a separate choice, since
 * the rail's toggle only hides them. `min_score` is always sent because the
 * curator's own default is 0.6.
 */
export function selectBody(
  filters: CuratorFilters,
  keepSimilar: boolean,
  summary: Pick<ScanSummary, "garments_config"> | null = null,
): SelectRequest {
  const listed = <T,>(values: readonly T[]): T[] | null => (values.length > 0 ? [...values] : null);
  return {
    min_score: filters.minScore,
    keep_similar: keepSimilar,
    face_clusters: listed(filters.faceClusters),
    face_poses: listed(filters.poses),
    face_races: listed(filters.faceRaces),
    face_genders: listed(filters.faceGenders),
    face_ages: listed(filters.faceAges),
    min_age_years: filters.minAgeYears,
    max_age_years: filters.maxAgeYears,
    min_attribute_conf: filters.minAttributeConf,
    scenes: listed(filters.scenes),
    scene_environments: listed(filters.sceneEnvironments),
    min_scene_conf: filters.minSceneConf,
    garments: listed(filters.garments),
    exclude_garments: listed(filters.excludeGarments),
    // The curator refuses a floor under what the scan recorded.
    min_garment_conf: Math.max(filters.minGarmentConf, summary?.garments_config?.min_conf ?? 0),
    garments_uncropped: filters.garmentsUncropped,
  };
}

/**
 * Why a capped export cannot go yet, or null. It names no selection, so the
 * curator picks from its own keep set. A frame this app holds but the curator
 * keeps would go out, so that refuses here. Fresh means the viewer has seen
 * this set.
 */
export function capProblem(cap: CapOptions, fresh: boolean, kept: number, usable: number): string | null {
  if (!Number.isInteger(cap.max_keep) || (cap.max_keep ?? 0) < 1) return "Enter how many to keep.";
  if (!fresh) return "Preview the keep set first.";
  if (usable < kept) return "The curator's keep set has frames this app holds, so use the selection instead.";
  return null;
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
  "face-attributes-missing": "No face attributes",
  "face-race-excluded": "Other race (predicted)",
  "face-gender-excluded": "Other gender (predicted)",
  "face-age-excluded": "Other age bracket (predicted)",
  "face-age-out-of-range": "Age outside the range",
  "face-age-years-missing": "No age in years",
  "scene-missing": "No scene tags",
  "scene-excluded": "Other scene",
  "scene-low-confidence": "Scene below the confidence",
  "scene-environment-excluded": "Other environment",
  "scene-environment-low-confidence": "Environment below the confidence",
  "garments-missing": "No garment reading",
  "garment-excluded": "Excluded garment",
  "garment-not-found": "Garment not found",
  "garment-low-confidence": "Garment below the confidence",
  "garment-cropped": "Garment cut off by the frame",
  "diversity-trimmed": "Trimmed by the cap",
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
