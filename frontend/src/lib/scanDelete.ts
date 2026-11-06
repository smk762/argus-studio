/**
 * Pure rules for deleting source images from a scan (POST /scan/{id}/delete).
 *
 * The request is all-or-nothing up front, but a file that fails to unlink stops
 * the batch after earlier files are already gone, so a failed delete may still
 * have removed some of what it asked for.
 */

/** Curator's `DeleteRequest.rel_paths` limit. A longer list is a 422. */
export const DELETE_BATCH_SIZE = 200;

/** Split paths into requests the server will accept. */
export function deleteBatches(paths: readonly string[], size = DELETE_BATCH_SIZE): string[][] {
  const batches: string[][] = [];
  for (let start = 0; start < paths.length; start += size) batches.push(paths.slice(start, start + size));
  return batches;
}

/** What a delete did. `error` stopped it, so paths in neither list may or may not be gone. */
export interface DeleteOutcome {
  deleted: string[];
  /** Paths the server would not delete without `delete_any`. Their files are untouched. */
  refused: string[];
  error: Error | null;
}

const images = (count: number) => `${count} image${count === 1 ? "" : "s"}`;

/** The confirm prompt. Names frames a filter is hiding, since those go too. */
export function deleteConfirmText(count: number, hidden = 0): string {
  const offScreen = hidden > 0 ? ` ${hidden} of them ${hidden === 1 ? "is" : "are"} hidden by the current filters.` : "";
  return `Permanently delete ${images(count)} from disk?${offScreen} The source files are removed and this cannot be undone.`;
}

/** The line to show once a delete ends. `failed` marks it as an error rather than a notice. */
export function deleteReport(requested: number, outcome: DeleteOutcome): { text: string; failed: boolean } {
  const { deleted, refused, error } = outcome;
  if (error) {
    return { text: `Stopped after deleting ${deleted.length} of ${requested}: ${error.message}`, failed: true };
  }
  if (refused.length > 0) {
    return {
      text:
        `Deleted ${deleted.length} of ${requested}. The curator kept ${refused.length} its own under-18 check ` +
        "did not flag. Deleting those needs CURATOR_ALLOW_DELETE=1.",
      failed: true,
    };
  }
  return { text: `Deleted ${images(deleted.length)} from disk.`, failed: false };
}
