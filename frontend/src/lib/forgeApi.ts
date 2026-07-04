/**
 * Thin client for the argus-forge API (:8103) — the training bridge that
 * turns a curator export (images + manifest.jsonl + .txt sidecars) into
 * ready-to-run trainer configs. Shapes mirror `argus_forge.models`
 * (schema/forge-wire.schema.json in smk762/argus-forge).
 */

import type { TargetCategory, TargetProfile } from "@/components/curator/types";
import { FORGE_URL } from "@/lib/curatorEnv";

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

export interface ForgeTrainerInfo {
  id: TrainerId;
  label: string;
  files: string[];
  notes: string;
}

async function asError(resp: Response): Promise<never> {
  const detail = await resp.json().catch(() => null);
  throw new Error(detail?.detail ?? `Server error: ${resp.status}`);
}

/** List supported trainers and what forge emits for each (GET /trainers). */
export async function listTrainers(signal?: AbortSignal): Promise<ForgeTrainerInfo[]> {
  const resp = await fetch(`${FORGE_URL}/trainers`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Look at an export dir without writing anything (POST /inspect). */
export async function forgeInspect(
  exportDir: string,
  category?: TargetCategory,
  signal?: AbortSignal,
): Promise<ForgeDatasetInfo> {
  const resp = await fetch(`${FORGE_URL}/inspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ export_dir: exportDir, category: category ?? null }),
    signal,
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/**
 * Render trainer configs for an export dir (POST /config). Forge collects
 * caption sidecars from the manifest's source paths first, so running this
 * after the lens caption handoff picks the fresh captions up. `dry_run`
 * returns file contents without touching the filesystem.
 */
export async function forgeConfig(req: ForgeRequest, signal?: AbortSignal): Promise<ForgeResult> {
  const resp = await fetch(`${FORGE_URL}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}
