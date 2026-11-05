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
  type ScanSummary,
} from "@/components/curator/types";

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

/**
 * The scan after those paths left it. Counts follow the rows still on screen,
 * and `total` keeps the rows a paged load never fetched. An identity whose
 * representative moved takes the next frame with that face, so the rail does
 * not request the moved thumb, and goes only when no such frame is left.
 */
export function withoutRelPaths(summary: ScanSummary, gone: readonly string[]): ScanSummary {
  const drop = new Set(gone.filter(Boolean));
  if (drop.size === 0) return summary;
  const results = summary.results.filter((img) => !drop.has(img.rel_path));
  return {
    ...summary,
    total: summary.total - (summary.results.length - results.length),
    passed: results.filter((img) => img.passed).length,
    rejected: results.filter((img) => !img.passed).length,
    duplicates: results.filter((img) => img.is_duplicate).length,
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
