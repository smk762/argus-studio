/**
 * The optional refinement stage on /proof (#68): a finer 1–5 re-rank, with
 * notes, of the images that already passed the quality stage. A separate layer
 * from the first-pass rating: it never changes `passed`, the aggregate or the
 * verdict.
 *
 * Mirrors argus_proof.refinement so the demo can apply a refinement locally and
 * a live page can order the passing set without a `GET /refined` round trip:
 * the rules here must match the server's.
 */

import type { EvalReport, ImageScores, RefinementImageUpdate } from "@/lib/proofApi";
import { permits, type Capability } from "@/lib/capabilities";

/** A reviewer's unsaved refinement of one image. `rank: null` retracts it. */
export interface RefinementEdit {
  rank: number | null;
  notes: string | null;
}

/** The images the refinement stage may re-rank: those the quality stage passed. */
export function passingSubset(images: readonly ImageScores[]): ImageScores[] {
  return images.filter((img) => img.passed === true);
}

/**
 * The passing subset best-first, as `GET /report/{id}/refined` orders it:
 * refined images above unrefined ones, then higher refined rank, then higher
 * first-pass rating, then `image_id` as a stable tie-break.
 */
export function refinedRanking(images: readonly ImageScores[]): ImageScores[] {
  const key = (img: ImageScores) => [
    img.refinement ? 0 : 1,
    -(img.refinement?.rank ?? 0),
    -(img.hitl_rating ?? 0),
  ];
  return passingSubset(images).sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return a.image_id < b.image_id ? -1 : a.image_id > b.image_id ? 1 : 0;
  });
}

/** What an image's refinement is before any edit. */
export function storedRefinement(img: ImageScores): RefinementEdit {
  return { rank: img.refinement?.rank ?? null, notes: img.refinement?.notes ?? null };
}

/**
 * `edits` with `patch` applied to `img`'s edit. An edit that ends up equal to
 * the stored refinement is dropped, so the unsaved count only counts changes.
 * Clearing the rank retracts, which takes the note with it, as on the server.
 */
export function withRefinementEdit(
  edits: Map<string, RefinementEdit>,
  img: ImageScores,
  patch: Partial<RefinementEdit>,
): Map<string, RefinementEdit> {
  const stored = storedRefinement(img);
  const merged = { ...(edits.get(img.image_id) ?? stored), ...patch };
  const edit = merged.rank === null ? { rank: null, notes: null } : merged;
  const next = new Map(edits);
  if (edit.rank === stored.rank && (edit.notes ?? "") === (stored.notes ?? "")) next.delete(img.image_id);
  else next.set(img.image_id, edit);
  return next;
}

/** Edits in the wire shape `POST /report/{id}/refine` expects. A note is sent
 * as typed (an empty one clears the stored note); a retraction sends no note. */
export function refinementUpdates(edits: Map<string, RefinementEdit>): RefinementImageUpdate[] {
  return [...edits.entries()].map(([image_id, e]) =>
    e.rank === null ? { image_id, rank: null } : { image_id, rank: e.rank, notes: e.notes ?? "" },
  );
}

/**
 * Fold refinement edits into a copy of `report`, as argus_proof's
 * `apply_refinement` does: rank replaces, an omitted note or rater keeps the
 * stored one, a null rank retracts the whole layer. Every edit must target a
 * passing image; anything else throws, like the server's 400.
 */
export function applyRefinement(
  report: EvalReport,
  edits: Map<string, RefinementEdit>,
  rater: string | null,
): EvalReport {
  const passing = new Set(passingSubset(report.images).map((img) => img.image_id));
  const stray = [...edits.keys()].filter((id) => !passing.has(id));
  if (stray.length > 0) throw new Error(`cannot refine images not in the passing subset: ${stray.join(", ")}`);
  const byId = new Map(refinementUpdates(edits).map((u) => [u.image_id, u]));
  return {
    ...report,
    images: report.images.map((img) => {
      const upd = byId.get(img.image_id);
      if (!upd) return img;
      if (upd.rank === null) return { ...img, refinement: null };
      const prior = img.refinement;
      return {
        ...img,
        refinement: {
          rank: upd.rank,
          notes: upd.notes ?? prior?.notes ?? null,
          rater: rater ?? prior?.rater ?? null,
        },
      };
    }),
  };
}

/**
 * Where a refinement save goes: the proof server only when the panel is live and the host permits writes,
 * otherwise applied locally, or nowhere on a live host that refuses (or hasn't answered yet). The button's label
 * and the save read this one answer, so a stale capability on a panel that isn't live can't send a POST.
 */
export function refinementSaveVia(live: boolean, canWrite: Capability): "server" | "local" | null {
  if (!live) return "local";
  return permits(canWrite) ? "server" : null;
}
