/**
 * Demo-mode forge: client-side kohya TOML built from the same
 * suggestTrainingParams heuristics, so the read-only demo can hand out a
 * config the way it hands out manifest.jsonl. Live mode calls argus-forge
 * instead (lib/forgeApi.ts), which also handles OneTrainer/diffusers,
 * caption collection and manifest-aware checkpoints.
 */

import type { TargetCategory, TrainingParams } from "./types";
import { suggestTrainingParams } from "./types";

const DEMO_IMAGE_DIR = "/data/out";
const SDXL_BASE = "stabilityai/stable-diffusion-xl-base-1.0";

const s = (v: string) => JSON.stringify(v); // TOML basic strings share JSON escaping

const optimizerSteps = (p: TrainingParams) => Math.ceil(p.totalSteps / p.batchSize);

function stepsComment(p: TrainingParams): string {
  return `# ${p.images} images x ${p.repeats} repeats x ${p.epochs} epochs = ${p.totalSteps} samples (${optimizerSteps(p)} optimizer steps @ batch ${p.batchSize})`;
}

export function buildKohyaDatasetToml(count: number, category: TargetCategory, trigger: string): string {
  const p = suggestTrainingParams(count, category);
  return `# argus-forge (demo) dataset config for kohya sd-scripts (pass via --dataset_config)
${stepsComment(p)}

[general]
enable_bucket = true
caption_extension = ".txt"
shuffle_caption = false
keep_tokens = 0

[[datasets]]
resolution = ${p.resolution}
batch_size = ${p.batchSize}
min_bucket_reso = 256
max_bucket_reso = 2048
bucket_reso_steps = 64

[[datasets.subsets]]
# Demo placeholder — point this at your exported dataset.
image_dir = ${s(DEMO_IMAGE_DIR)}
num_repeats = ${p.repeats}
# Fallback caption for images without a .txt sidecar.
class_tokens = ${s(trigger)}
`;
}

export function buildKohyaConfigToml(count: number, category: TargetCategory, outputName: string): string {
  const p = suggestTrainingParams(count, category);
  const warmup = Math.floor(0.05 * optimizerSteps(p));
  return `# argus-forge (demo) training config for kohya sd-scripts (pass via --config_file)
# Seeded from argus-curator selection insights (${category}, ${p.images} images).
# Starting points, not gospel — watch samples and stop early if it overfits.

pretrained_model_name_or_path = ${s(SDXL_BASE)}
output_dir = ${s(`${DEMO_IMAGE_DIR}/forge/kohya/output`)}
output_name = ${s(outputName)}
save_model_as = "safetensors"
save_every_n_epochs = 1
save_precision = ${s(p.precision)}

max_train_epochs = ${p.epochs}
train_batch_size = ${p.batchSize}
seed = 42
mixed_precision = ${s(p.precision)}

network_module = "networks.lora"
network_dim = ${p.networkDim}
network_alpha = ${p.networkAlpha}

learning_rate = ${p.unetLr}
unet_lr = ${p.unetLr}
text_encoder_lr = ${p.textEncoderLr}
optimizer_type = ${s(p.optimizer)}
lr_scheduler = ${s(p.scheduler)}
lr_warmup_steps = ${warmup}
min_snr_gamma = 5

gradient_checkpointing = true
cache_latents = true
sdpa = true
# SDXL's fp16 VAE is numerically unstable; keep it in fp32.
no_half_vae = true
logging_dir = ${s(`${DEMO_IMAGE_DIR}/forge/kohya/logs`)}
`;
}

/**
 * Trigger token argus-forge would derive from a name, mirroring
 * `argus_forge.core.slugify` (`My Set!` -> `my_set`). Kept here so the UI can
 * show the token that will actually be written rather than the raw text — the
 * two differ for any name with spaces, capitals or punctuation.
 */
export function forgeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_+|_+$)/g, "") || "dataset";
}

/**
 * The kohya pair a demo-mode config run produces.
 *
 * Owns the trigger/output-name distinction the two builders take: the dataset
 * config gets the *trigger* token (kohya's `class_tokens`) while the training
 * config gets the *output name* (the .safetensors filename). Passing the
 * trigger to both — which is easy to do, since the signatures are structurally
 * identical — names the checkpoint after the token, and diverges from what a
 * live forge writes (`<slug>-lora`, argus_forge.core).
 */
export function demoKohyaFiles(
  count: number,
  category: TargetCategory,
  trigger: string,
): { name: string; content: string }[] {
  const token = forgeSlug(trigger);
  return [
    { name: "dataset.toml", content: buildKohyaDatasetToml(count, category, token) },
    { name: "config.toml", content: buildKohyaConfigToml(count, category, `${token}-lora`) },
  ];
}
