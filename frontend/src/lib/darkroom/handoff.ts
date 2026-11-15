/**
 * The proof → darkroom handoff (#199): a passed proof report opens /darkroom
 * with the checkpoint and LoRAs that run evaluated. Both ends live here, so
 * the URL proof writes is the URL darkroom reads.
 *
 * Models are matched by sha256 first (the real identity: proof and darkroom
 * may file the same model under different names), then by exact name. Never
 * fuzzily: a model darkroom does not have is reported as missing, and the form
 * keeps its own choice for it rather than silently using something else.
 */

import type { ComposeState } from "@/lib/darkroom/compose";
import type { Models, ModelOption } from "@/lib/darkroomApi";

export interface HandoffModel {
  name: string;
  sha256: string | null;
}

export interface HandoffLora extends HandoffModel {
  weight: number;
}

export interface DarkroomHandoff {
  /** The proof run it came from, for the notice. */
  from: string | null;
  checkpoint: HandoffModel | null;
  loras: HandoffLora[];
}

const SHA = /^[0-9a-f]{64}$/;
const sha = (v: string | null | undefined): string | null => (v && SHA.test(v.toLowerCase()) ? v.toLowerCase() : null);
const weightOf = (v: string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, -4), 4) : 1;
};

/** The manifest fields the handoff reads (argus-proof `RunManifest`). */
export interface ManifestModels {
  run_id: string;
  base_checkpoint: { name: string; sha256?: string | null };
  loras?: { name: string; sha256?: string | null; weight?: number | null }[];
}

/** `/darkroom` prefilled with a proof run's checkpoint and LoRAs. LoRA params repeat, in order. */
export function darkroomHandoffHref(manifest: ManifestModels): string {
  // A malformed manifest (no checkpoint) hands off nothing rather than crash the page.
  if (typeof manifest?.base_checkpoint?.name !== "string" || !manifest.base_checkpoint.name) return "/darkroom";
  const q = new URLSearchParams();
  q.set("from", manifest.run_id);
  q.set("checkpoint", manifest.base_checkpoint.name);
  const ckptSha = sha(manifest.base_checkpoint.sha256);
  if (ckptSha) q.set("checkpoint_sha256", ckptSha);
  for (const lora of (Array.isArray(manifest.loras) ? manifest.loras : []).filter((l) => typeof l?.name === "string" && l.name)) {
    q.append("lora", lora.name);
    q.append("lora_sha256", sha(lora.sha256) ?? "");
    q.append("lora_weight", String(lora.weight ?? 1));
  }
  return `/darkroom?${q.toString()}`;
}

/** The handoff in a /darkroom query, or null when there is none. */
export function parseHandoff(params: URLSearchParams): DarkroomHandoff | null {
  const name = params.get("checkpoint")?.trim();
  const loraNames = params.getAll("lora");
  if (!name && loraNames.length === 0) return null;
  const shas = params.getAll("lora_sha256");
  const weights = params.getAll("lora_weight");
  return {
    from: params.get("from")?.trim() || null,
    checkpoint: name ? { name, sha256: sha(params.get("checkpoint_sha256")) } : null,
    loras: loraNames
      .map((n, i) => ({ name: n.trim(), sha256: sha(shas[i]), weight: weightOf(weights[i]) }))
      .filter((l) => l.name),
  };
}

/** The darkroom option for a handed-off model: same sha256, else same name; null when there is none. */
export function matchModel(want: HandoffModel, options: readonly ModelOption[]): ModelOption | null {
  if (want.sha256) {
    const bySha = options.find((o) => o.sha256?.toLowerCase() === want.sha256);
    if (bySha) return bySha;
  }
  return options.find((o) => o.name === want.name) ?? null;
}

export interface HandoffResult {
  state: ComposeState;
  /** What was selected, by darkroom's name for it. */
  applied: string[];
  /** Models darkroom's list doesn't have, by the name proof used. */
  missing: string[];
}

/**
 * Select the handed-off models in the compose form. A checkpoint darkroom lacks
 * leaves the form's checkpoint as it was; LoRAs darkroom lacks are left out.
 * Each comes back in `missing`, so the page can say so.
 */
export function applyHandoff(state: ComposeState, handoff: DarkroomHandoff, models: Models): HandoffResult {
  const applied: string[] = [];
  const missing: string[] = [];
  let checkpoint = state.checkpoint;
  if (handoff.checkpoint) {
    const hit = matchModel(handoff.checkpoint, models.checkpoints);
    if (hit) {
      checkpoint = hit.name;
      applied.push(hit.name);
    } else missing.push(handoff.checkpoint.name);
  }
  const loras = handoff.loras.flatMap((l) => {
    const hit = matchModel(l, models.loras);
    if (!hit) {
      missing.push(l.name);
      return [];
    }
    applied.push(`${hit.name} @ ${l.weight}`);
    return [{ name: hit.name, weight: l.weight, trigger_words: [...(hit.trigger_words ?? [])] }];
  });
  return { state: { ...state, checkpoint, loras: handoff.loras.length > 0 ? loras : state.loras }, applied, missing };
}
