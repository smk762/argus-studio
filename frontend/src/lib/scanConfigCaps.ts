/**
 * Scan options the curator's /health refuses (audit pack-argus-studio-d24b0a4850).
 * A disabled control keeps its value, so a stale `true` (a restored config, or a
 * curator whose capabilities changed) would show checked but greyed out and still
 * go out with the scan. These are switched off instead. Only a definite refusal
 * (`false`) clears a flag: while /health is unknown (`null`) nothing changes.
 *
 * The same goes for an option whose detector `/detectors` does not list (audit
 * pack-argus-studio-8c9b0e1890): its control is not drawn at all, so nobody
 * could switch the stale `true` off. A list that has not loaded clears nothing.
 */

import type { CuratorConfig, Detectors } from "@/components/curator/types";
import type { Capability } from "@/lib/capabilities";

export interface ScanCaps {
  setAge: Capability;
  prefilter: Capability;
  crops: Capability;
  /** A chosen SingGuard mode. Optional: absent clears nothing. */
  guardThinking?: Capability;
  /** Watermark detection refused, or no watermark detector configured. */
  watermarkDenied: boolean;
  /** `/detectors`. Null or absent until known. */
  detectors?: Detectors | null;
}

/** Which detector-gated controls the panel draws. All false until `/detectors` is known. */
export function offeredDetectors(detectors: Detectors | null | undefined) {
  const mivolo = detectors?.mivolo === true;
  return {
    fairface: detectors?.fairface === true,
    mivolo,
    mivoloBody: mivolo && detectors?.bodies === true,
    scenes: detectors?.places365 === true,
    garments: detectors?.garments === true,
  };
}

/** `config` with every refused option off; the same object when nothing changes. */
export function clearDenied(config: CuratorConfig, caps: ScanCaps): CuratorConfig {
  let next = config;
  if (caps.setAge === false && next.faces.set_age) next = { ...next, faces: { ...next.faces, set_age: false } };
  if (caps.prefilter === false && (next.prefilter.drop_nsfw || next.prefilter.drop_no_face || next.prefilter.drop_no_age)) {
    next = { ...next, prefilter: { ...next.prefilter, drop_nsfw: false, drop_no_face: false, drop_no_age: false } };
  }
  if (caps.guardThinking === false && next.guard.thinking) next = { ...next, guard: { ...next.guard, thinking: null } };
  if (caps.crops === false && next.crops.enabled) next = { ...next, crops: { ...next.crops, enabled: false } };
  if (caps.watermarkDenied && next.crops.detect) next = { ...next, crops: { ...next.crops, detect: false } };
  if (caps.detectors != null) {
    const has = offeredDetectors(caps.detectors);
    const faces = { ...next.faces };
    if (!has.fairface && faces.fairface) faces.fairface = false;
    if (!has.mivolo && faces.mivolo) faces.mivolo = false;
    if (!has.mivolo && faces.set_age) faces.set_age = false;
    if (!has.mivoloBody && faces.mivolo_body) faces.mivolo_body = false;
    if ((Object.keys(faces) as (keyof typeof faces)[]).some((key) => faces[key] !== next.faces[key])) next = { ...next, faces };
    if (!has.scenes && next.scenes.enabled) next = { ...next, scenes: { ...next.scenes, enabled: false } };
    if (!has.garments && next.garments.enabled) next = { ...next, garments: { ...next.garments, enabled: false } };
  }
  return next;
}
