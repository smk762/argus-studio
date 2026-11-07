/**
 * What an export asks for beyond the transfer, and what it reports back.
 */

import type { ExportResult, ImageResult, ScanSummary } from "@/components/curator/types";

/** Curator refuses a name over this, and a blank one. */
export const MAX_FACE_NAME = 200;

/**
 * Names for `face_names`: trimmed, with blanks left out, since curator refuses
 * a blank name rather than treating it as unnamed. Null when none are left.
 */
export function faceNamesBody(names: Record<string, string>): Record<string, string> | null {
  const entries = Object.entries(names)
    .map(([cluster, name]) => [cluster, name.trim()] as const)
    .filter(([, name]) => name.length > 0);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/** The first name curator would refuse, as a message, or null. */
export function faceNamesProblem(names: Record<string, string>): string | null {
  const long = Object.entries(names).find(([, name]) => name.trim().length > MAX_FACE_NAME);
  return long ? `The name for ${long[0]} is over ${MAX_FACE_NAME} characters.` : null;
}

/**
 * Any cropped row makes the whole scan copy-only: the curator's request check
 * reads every row, not just the selected ones, because a link or a move would
 * hand on the uncropped source.
 */
export function scanHasCrops(results: readonly ImageResult[]): boolean {
  return results.some((row) => row.crop != null);
}

/** The lines an export's result adds beyond the transfer count. Sidecar failures are returned apart, as a warning. */
export function exportNotes(
  result: Pick<ExportResult, "cropped" | "xmp_written" | "sidecars_carried" | "sidecars_failed">,
): { notes: string[]; warning: string | null } {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const notes: string[] = [];
  if (result.cropped) notes.push(`${plural(result.cropped, "image")} written cropped.`);
  if (result.xmp_written) notes.push(`${plural(result.xmp_written, "XMP sidecar")} written.`);
  if (result.sidecars_carried) notes.push(`${plural(result.sidecars_carried, "sidecar")} carried.`);
  const failed = result.sidecars_failed ?? 0;
  return {
    notes,
    warning: failed > 0 ? `${plural(failed, "sidecar")} could not be carried. The curator's log names them.` : null,
  };
}

/**
 * The numbers of this export, for `run_stats.json`. Counts and settings only:
 * no path list, and no ages or scores.
 */
export function buildRunStats(
  summary: ScanSummary,
  exporting: readonly ImageResult[],
  curatorVersion: string | null,
  now: Date = new Date(),
): Record<string, unknown> {
  return {
    generated_at: now.toISOString(),
    generator: "argus-studio",
    curator_version: curatorVersion,
    scan_id: summary.scan_id,
    folder: summary.folder,
    target_profile: summary.target_profile,
    images: {
      total: summary.total,
      passed: summary.passed,
      rejected: summary.rejected,
      duplicates: summary.duplicates,
      reject_reasons: summary.reject_reasons,
      exporting: exporting.length,
      cropped: exporting.filter((row) => row.crop != null).length,
    },
    config: {
      faces: summary.faces_config.enabled,
      nsfw: summary.nsfw_config?.enabled === true,
      prefilter: summary.prefilter_config ?? null,
      crops: summary.crop_config?.enabled === true,
      watermark_detect: summary.crop_config?.enabled === true && summary.crop_config.detect === true,
    },
  };
}
