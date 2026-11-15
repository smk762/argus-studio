/**
 * Scan options the curator's /health refuses (audit pack-argus-studio-d24b0a4850).
 * A disabled control keeps its value, so a stale `true` (a restored config, or a
 * curator whose capabilities changed) would show checked but greyed out and still
 * go out with the scan. These are switched off instead. Only a definite refusal
 * (`false`) clears a flag: while /health is unknown (`null`) nothing changes.
 */

import type { CuratorConfig } from "@/components/curator/types";
import type { Capability } from "@/lib/capabilities";

export interface ScanCaps {
  setAge: Capability;
  prefilter: Capability;
  crops: Capability;
  /** Watermark detection refused, or no watermark detector configured. */
  watermarkDenied: boolean;
}

/** `config` with every refused option off; the same object when nothing changes. */
export function clearDenied(config: CuratorConfig, caps: ScanCaps): CuratorConfig {
  let next = config;
  if (caps.setAge === false && next.faces.set_age) next = { ...next, faces: { ...next.faces, set_age: false } };
  if (caps.prefilter === false && (next.prefilter.drop_nsfw || next.prefilter.drop_no_face || next.prefilter.drop_no_age)) {
    next = { ...next, prefilter: { ...next.prefilter, drop_nsfw: false, drop_no_face: false, drop_no_age: false } };
  }
  if (caps.crops === false && next.crops.enabled) next = { ...next, crops: { ...next.crops, enabled: false } };
  if (caps.watermarkDenied && next.crops.detect) next = { ...next, crops: { ...next.crops, detect: false } };
  return next;
}
