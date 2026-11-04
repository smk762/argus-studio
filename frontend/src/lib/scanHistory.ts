/**
 * A cached scan is the curator's record, not the browser's. Again refills the
 * form from that record, and a move export has already dropped its rows there,
 * so the grid must drop them before the next thumb request.
 */

import {
  clampShortSide,
  defaultCuratorConfig,
  type CuratorConfig,
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
 * The scan after those paths left it. Counts follow the rows still on screen.
 * Face clusters whose representative moved go with it, so the rail does not
 * request that thumb.
 */
export function withoutRelPaths(summary: ScanSummary, gone: readonly string[]): ScanSummary {
  const drop = new Set(gone.filter(Boolean));
  if (drop.size === 0) return summary;
  const results = summary.results.filter((img) => !drop.has(img.rel_path));
  return {
    ...summary,
    total: results.length,
    passed: results.filter((img) => img.passed).length,
    rejected: results.filter((img) => !img.passed).length,
    duplicates: results.filter((img) => img.is_duplicate).length,
    face_clusters: summary.face_clusters.filter((cluster) => !drop.has(cluster.representative_rel_path)),
    results,
    returned: results.length,
  };
}
