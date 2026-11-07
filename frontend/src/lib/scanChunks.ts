/**
 * A running scan delivers its images in batches (`event: chunk`, curator 0.5
 * and later) and says which checks are still in flight (0.5.1). Later batches
 * replace the same frame once a check fills in; 0.14 sends `face_clusters` on
 * every chunk, and an empty list is meaningful — the prefilter can clear it.
 */

import {
  defaultCuratorConfig,
  type CuratorConfig,
  type FaceCluster,
  type ImageResult,
  type ScanSummary,
} from "@/components/curator/types";

export interface ScanChunk {
  scan_id: string;
  folder: string;
  phase: string;
  done: number;
  total: number;
  pending_checks?: string[];
  results: ImageResult[];
  /** Present on every chunk from curator 0.14, including when empty. */
  face_clusters?: FaceCluster[];
}

const CHECK_NAMES: Record<string, string> = {
  faces: "faces",
  nsfw: "nudity",
  guard: "policy",
};

/** Checks this frame is still waiting on. A rejected frame is not waiting. */
export function imagePending(img: ImageResult, pending: readonly string[]): string[] {
  if (img.passed === false || pending.length === 0) return [];
  const waiting: string[] = [];
  if (pending.includes("faces") && img.face_count === 0 && (img.faces?.length ?? 0) === 0) waiting.push("faces");
  if (pending.includes("nsfw") && img.nsfw == null && !img.nudenet_failed) waiting.push("nsfw");
  if (pending.includes("guard") && img.guard == null) waiting.push("guard");
  return waiting;
}

export function pendingCaption(checks: readonly string[]): string {
  return checks.map((check) => CHECK_NAMES[check] ?? check).join(", ");
}

/** How these rows count toward a summary's passed, rejected and duplicate totals. */
export function rowCounts(rows: readonly ImageResult[]): Pick<ScanSummary, "passed" | "rejected" | "duplicates"> {
  return {
    passed: rows.filter((img) => img.passed).length,
    rejected: rows.filter((img) => !img.passed).length,
    duplicates: rows.filter((img) => img.is_duplicate).length,
  };
}

/**
 * Fold one batch into the scan on screen. First-seen order is kept, a later
 * batch replaces the same `rel_path`, and a chunk that carries clusters
 * (even `[]`) replaces the ones on screen.
 */
export function mergeChunk(current: ScanSummary | null, chunk: ScanChunk, requested?: CuratorConfig): ScanSummary {
  const byPath = new Map<string, ImageResult>();
  const order: string[] = [];
  for (const img of current?.results ?? []) {
    byPath.set(img.rel_path, img);
    order.push(img.rel_path);
  }
  for (const img of chunk.results ?? []) {
    if (!byPath.has(img.rel_path)) order.push(img.rel_path);
    byPath.set(img.rel_path, img);
  }
  const results = order.map((path) => byPath.get(path)!);
  const base = current ?? emptySummary(chunk, requested);
  return {
    ...base,
    scan_id: chunk.scan_id || base.scan_id,
    folder: chunk.folder || base.folder,
    total: Math.max(chunk.total || 0, results.length, base.total || 0),
    ...rowCounts(results),
    face_clusters: chunk.face_clusters !== undefined ? chunk.face_clusters : base.face_clusters,
    // Chunks carry no `nsfw_config`. A row left unscored must not read as clear
    // while the scan is asking for nudity, or when an older curator cannot say.
    nsfw_config: base.nsfw_config?.enabled ? base.nsfw_config : { enabled: chunk.pending_checks?.includes("nsfw") ?? true },
    results,
    returned: results.length,
  };
}

function emptySummary(chunk: ScanChunk, requested?: CuratorConfig): ScanSummary {
  const cfg = requested ?? defaultCuratorConfig();
  return {
    scan_id: chunk.scan_id,
    folder: chunk.folder,
    target_profile: cfg.profile,
    config: cfg.config,
    faces_config: cfg.faces,
    scenes_config: cfg.scenes,
    garments_config: cfg.garments,
    total: 0,
    passed: 0,
    rejected: 0,
    duplicates: 0,
    similar_clusters: 0,
    reject_reasons: {},
    face_clusters: [],
    results: [],
    offset: 0,
    limit: null,
    returned: 0,
  };
}
