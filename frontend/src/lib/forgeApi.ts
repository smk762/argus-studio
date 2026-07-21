/**
 * Thin client for the argus-forge API (:8103) — the training bridge that
 * turns a curator export (images + manifest.jsonl + .txt sidecars) into
 * ready-to-run trainer configs. Shapes mirror `argus_forge.models`
 * (schema/forge-wire.schema.json in smk762/argus-forge).
 */

import type { TargetCategory, TargetProfile } from "@/components/curator/types";
import { forgeUrl } from "@/lib/curatorEnv";
import { asError } from "@/lib/apiError";
import { capabilityOf, type Capability } from "@/lib/capabilities";

export type TrainerId = "kohya" | "onetrainer" | "diffusers";

export const TRAINER_LABELS: Record<TrainerId, string> = {
  kohya: "kohya sd-scripts",
  onetrainer: "OneTrainer",
  diffusers: "diffusers",
};

export interface ForgeTrainingParams {
  images: number;
  repeats: number;
  epochs: number;
  total_steps: number;
  optimizer_steps: number;
  network_dim: number;
  network_alpha: number;
  unet_lr: number;
  text_encoder_lr: number;
  optimizer: string;
  scheduler: string;
  resolution: number;
  batch_size: number;
  precision: string;
}

export interface ForgeParamOverrides {
  repeats?: number;
  epochs?: number;
  network_dim?: number;
  network_alpha?: number;
  unet_lr?: number;
  text_encoder_lr?: number;
  optimizer?: string;
  scheduler?: string;
  resolution?: number;
  batch_size?: number;
  precision?: string;
}

export interface ForgeSizeHint {
  tone: "empty" | "low" | "good" | "high";
  text: string;
}

export interface ForgeDatasetInfo {
  export_dir: string;
  image_count: number;
  caption_count: number;
  manifest_present: boolean;
  manifest_rows: number;
  manifest_version: string | null;
  missing_from_disk: number;
  target_profile: TargetProfile;
  size_hint: ForgeSizeHint;
  suggested: ForgeTrainingParams;
}

export interface ForgeRequest {
  export_dir: string;
  trainer: TrainerId;
  base_model?: string | null;
  trigger?: string | null;
  output_name?: string | null;
  category?: TargetCategory | null;
  overrides?: ForgeParamOverrides;
  collect_captions?: boolean;
  dry_run?: boolean;
}

export interface ForgeGeneratedFile {
  name: string;
  path: string | null;
  content: string;
}

export interface ForgeResult {
  trainer: TrainerId;
  export_dir: string;
  out_dir: string;
  files: ForgeGeneratedFile[];
  params: ForgeTrainingParams;
  dataset: ForgeDatasetInfo;
  base_model: string;
  trigger: string;
  output_name: string;
  captions_collected: number;
  warnings: string[];
}

export interface ForgeHealth {
  status: string;
  service: string;
  version: string;
  /** Absolute export root forge contains `export_dir` under, or null if unset. */
  export_root?: string | null;
  /**
   * `"disabled"` on a demo-safe host (argus-forge#16): `POST /config` still
   * renders configs, but live `POST /run` training returns 403. Lets a client
   * drop its train affordance up front rather than learn from the 403.
   */
  training?: "enabled" | "disabled";
}

export async function getForgeHealth(signal?: AbortSignal): Promise<ForgeHealth> {
  const resp = await fetch(`${forgeUrl()}/health`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/**
 * Whether this forge server will run training locally.
 *
 * Legacy `false`: unlike proof's read-only flag, a server omitting `training`
 * predates the run registry entirely, so there is nothing to enable — and
 * training is GPU work that fails slowly and expensively when wrongly offered.
 */
export function allowsTraining(health: ForgeHealth | null): Capability {
  // Only the two values forge actually advertises are believed; an absent field
  // (or a value a future forge adds) falls back to `legacy` rather than being
  // read as a settled refusal.
  return capabilityOf(
    health,
    (h) => (h.training === "enabled" ? true : h.training === "disabled" ? false : undefined),
    false,
  );
}

/**
 * Render trainer configs for an export dir (POST /config). Forge collects
 * caption sidecars from the manifest's source paths first, so running this
 * after the lens caption handoff picks the fresh captions up. `dry_run`
 * returns file contents without touching the filesystem.
 */
export async function forgeConfig(req: ForgeRequest, signal?: AbortSignal): Promise<ForgeResult> {
  const resp = await fetch(`${forgeUrl()}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}
