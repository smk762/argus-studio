/**
 * A cached scan is the curator's record, not the browser's. Again refills the
 * form from that record, and a move export has already dropped its rows there,
 * so the grid must drop them before the next thumb request.
 */

import {
  clampShortSide,
  defaultCuratorConfig,
  type CuratorConfig,
  type CuratorFilters,
  type ImageResult,
  type ScanSummary,
} from "@/components/curator/types";
import { rowCounts } from "@/lib/scanChunks";

/** The form a finished scan was run with, so Again differs only in what the viewer changes. */
export function configFromSummary(summary: ScanSummary): CuratorConfig {
  const base = defaultCuratorConfig();
  return {
    profile: { ...base.profile, ...summary.target_profile },
    config: {
      ...base.config,
      ...summary.config,
      min_short_side: clampShortSide(summary.config?.min_short_side),
    },
    faces: { ...base.faces, ...summary.faces_config },
  };
}

/** The curator's tally, which leaves out the detail in brackets. */
function withoutRejects(reasons: Record<string, number>, rows: readonly ImageResult[]): Record<string, number> {
  const next = { ...reasons };
  for (const img of rows) {
    if (img.passed) continue;
    const key = (img.reject_reason || "unknown").split("(")[0].trim();
    if (next[key] > 1) next[key] -= 1;
    else delete next[key];
  }
  return next;
}

/**
 * The scan after those paths left it, until the curator's own record replaces
 * it. Counts come down by the rows dropped, so the rows a paged load never
 * fetched still count. A near-duplicate cluster left with one frame stops being
 * a cluster. An identity whose representative moved takes the next frame with
 * that face, so the rail does not request the moved thumb, and goes only when
 * no such frame is left.
 */
export function withoutRelPaths(summary: ScanSummary, gone: readonly string[]): ScanSummary {
  const drop = new Set(gone.filter(Boolean));
  if (drop.size === 0) return summary;
  const dropped = summary.results.filter((img) => drop.has(img.rel_path));
  const left = new Map<number, number>();
  for (const img of dropped) {
    if (img.group_size <= 1) continue;
    left.set(img.similar_group, (left.get(img.similar_group) ?? img.group_size) - 1);
  }
  const results = summary.results
    .filter((img) => !drop.has(img.rel_path))
    .map((img) => {
      const size = img.group_size > 1 ? left.get(img.similar_group) : undefined;
      return size === undefined ? img : { ...img, group_size: size };
    });
  const removed = rowCounts(dropped);
  return {
    ...summary,
    total: summary.total - dropped.length,
    passed: summary.passed - removed.passed,
    rejected: summary.rejected - removed.rejected,
    duplicates: summary.duplicates - removed.duplicates,
    similar_clusters: summary.similar_clusters - [...left.values()].filter((size) => size <= 1).length,
    reject_reasons: withoutRejects(summary.reject_reasons, dropped),
    face_clusters: summary.face_clusters.flatMap((cluster) => {
      if (!drop.has(cluster.representative_rel_path)) return [cluster];
      const next = results.find((img) => img.faces.some((face) => face.cluster_id === cluster.cluster_id));
      return next ? [{ ...cluster, representative_rel_path: next.rel_path, representative_bbox: null }] : [];
    }),
    results,
    returned: results.length,
  };
}

/**
 * Filters without identities the scan no longer has. Filters outlive a scan
 * update, and the rail has no chip left to clear a gone identity with, so it
 * would otherwise hold the grid empty.
 */
export function knownClusterFilters(filters: CuratorFilters, summary: ScanSummary): CuratorFilters {
  const known = new Set(summary.face_clusters.map((cluster) => cluster.cluster_id));
  return { ...filters, faceClusters: filters.faceClusters.filter((id) => known.has(id)) };
}
