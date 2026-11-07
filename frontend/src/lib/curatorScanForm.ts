/**
 * Why the scan form as set would be refused. These mirror the curator's own 400s
 * (`prefilter.missing`, `_require_models`), so the choice can be fixed before
 * the scan button is pressed. `null` detectors means not known yet, which never
 * blocks: the curator still answers for itself.
 */

import type { CuratorConfig, Detectors } from "@/components/curator/types";
import { guardProblem } from "@/lib/curatorGuard";

/** The first prefilter rule whose check will not run. Without it, the face rules would drop every image. */
export function prefilterProblem(cfg: CuratorConfig, detectors: Detectors | null): string | null {
  const { drop_nsfw, drop_no_face, drop_no_age } = cfg.prefilter;
  if (drop_no_face && !cfg.faces.enabled) return "Drop no face needs Face Clustering on.";
  if (drop_no_age && !cfg.faces.enabled) return "Drop no age needs Face Clustering on.";
  if (drop_no_age && !cfg.faces.mivolo) return "Drop no age needs MiVOLO ages on.";
  if (drop_nsfw && detectors && !detectors.nudenet) return "Drop exposed needs NudeNet, and this curator has no NudeNet URL.";
  return null;
}

export function cropsProblem(cfg: CuratorConfig, detectors: Detectors | null): string | null {
  if (cfg.crops.enabled && cfg.crops.detect && detectors && !detectors.watermark) {
    return "Detect watermarks needs ARGUS_CURATOR_WATERMARK_URL set on the curator.";
  }
  return null;
}

/** A model the form asks for that this curator does not have. Again can bring one back from another server. */
export function modelProblem(cfg: CuratorConfig, detectors: Detectors | null): string | null {
  if (!detectors) return null;
  const wanted: [boolean, boolean | undefined, string][] = [
    [cfg.faces.fairface === true, detectors.fairface, "FairFace"],
    [cfg.faces.mivolo === true || cfg.faces.set_age === true, detectors.mivolo, "MiVOLO"],
    [cfg.faces.mivolo_body === true, detectors.mivolo && detectors.bodies, "Read bodies"],
    [cfg.scenes.enabled, detectors.places365, "Places365"],
    [cfg.garments.enabled, detectors.garments, "Fashionpedia"],
  ];
  const missing = wanted.find(([asked, have]) => asked && !have);
  return missing ? `${missing[2]} is on, and this curator does not have it.` : null;
}

export function scanFormProblem(cfg: CuratorConfig, detectors: Detectors | null): string | null {
  return (
    modelProblem(cfg, detectors) ??
    prefilterProblem(cfg, detectors) ??
    cropsProblem(cfg, detectors) ??
    guardProblem(cfg.guard, detectors?.singguard_policies ?? [])
  );
}
