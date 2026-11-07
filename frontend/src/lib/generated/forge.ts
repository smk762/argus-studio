// Generated from smk762/argus-forge@v0.1.1 schema/forge-wire.schema.json.
// Do not edit: change schema/pins.json and run `npm run wire:pull`.

export interface ForgeWire {
  DatasetInfo?: DatasetInfo;
  ForgeRequest?: ForgeRequest;
  ForgeResult?: ForgeResult;
  GeneratedFile?: GeneratedFile;
  InspectRequest?: InspectRequest;
  ManifestRow?: ManifestRow;
  ParamOverrides?: ParamOverrides;
  RunEvent?: RunEvent;
  RunRequest?: RunRequest;
  RunState?: RunState;
  SizeHint?: SizeHint;
  TargetProfile?: TargetProfile;
  TrainerInfo?: TrainerInfo;
  TrainingParams?: TrainingParams;
}
/**
 * What forge found in an export directory.
 */
export interface DatasetInfo {
  caption_count: number;
  export_dir: string;
  image_count: number;
  manifest_present: boolean;
  manifest_rows?: number;
  manifest_version?: string | null;
  missing_from_disk?: number;
  size_hint: SizeHint;
  suggested: TrainingParams;
  target_profile?: TargetProfile;
}
/**
 * Dataset-size guidance for the target category (mirrors the curate UI).
 */
export interface SizeHint {
  text: string;
  tone: "empty" | "low" | "good" | "high";
}
/**
 * Resolved hyperparameters for one LoRA run.
 *
 * ``total_steps`` counts sample presentations (images x repeats x epochs) —
 * the number the curate UI displays; ``optimizer_steps`` divides by batch
 * size, which is what trainers actually count.
 */
export interface TrainingParams {
  batch_size: number;
  epochs: number;
  images: number;
  network_alpha: number;
  network_dim: number;
  optimizer: string;
  optimizer_steps: number;
  precision: string;
  repeats: number;
  resolution: number;
  scheduler: string;
  text_encoder_lr: number;
  total_steps: number;
  unet_lr: number;
}
/**
 * What the dataset was curated *for* — inherited verbatim from argus-curator.
 */
export interface TargetProfile {
  checkpoint?: string | null;
  target_backend?: string | null;
  target_category?: "identity" | "wardrobe" | "pose_composition" | "setting";
  target_style?: "photo" | "anime";
}
/**
 * POST /config — render trainer configs for an export directory.
 */
export interface ForgeRequest {
  base_model?: string | null;
  category?: ("identity" | "wardrobe" | "pose_composition" | "setting") | null;
  collect_captions?: boolean;
  dry_run?: boolean;
  export_dir: string;
  output_name?: string | null;
  overrides?: ParamOverrides;
  path_map?: {
    [k: string]: string;
  };
  trainer: "kohya" | "onetrainer" | "diffusers";
  trigger?: string | null;
}
/**
 * Optional user overrides; anything unset keeps the heuristic value.
 */
export interface ParamOverrides {
  batch_size?: number | null;
  epochs?: number | null;
  network_alpha?: number | null;
  network_dim?: number | null;
  optimizer?: string | null;
  precision?: string | null;
  repeats?: number | null;
  resolution?: number | null;
  scheduler?: string | null;
  text_encoder_lr?: number | null;
  unet_lr?: number | null;
}
/**
 * Everything a caller (CLI, UI) needs to show or run the forged config.
 */
export interface ForgeResult {
  base_model: string;
  captions_collected?: number;
  dataset: DatasetInfo;
  export_dir: string;
  files: GeneratedFile[];
  out_dir: string;
  output_name: string;
  params: TrainingParams;
  trainer: "kohya" | "onetrainer" | "diffusers";
  trigger: string;
  warnings?: string[];
}
/**
 * One rendered file. ``name`` is relative to the export dir; ``path`` is
 * the absolute location once written (None on dry runs).
 */
export interface GeneratedFile {
  content: string;
  name: string;
  path?: string | null;
}
/**
 * POST /inspect — look at an export dir without writing anything.
 */
export interface InspectRequest {
  category?: ("identity" | "wardrobe" | "pose_composition" | "setting") | null;
  export_dir: string;
}
/**
 * One line of the curator's ``manifest.jsonl`` (the fields forge consumes).
 *
 * Unknown keys are ignored so a minor-version manifest with extra columns
 * still parses; a major-version bump is rejected up front in
 * :func:`argus_forge.manifest.read_manifest`.
 */
export interface ManifestRow {
  abs_path: string;
  exported_path?: string | null;
  manifest_version: string;
  primary_face_cluster?: string | null;
  primary_face_pose?: string | null;
  rel_path: string;
  score?: number;
  similar_group?: number;
  target_profile?: TargetProfile;
}
/**
 * One NDJSON line streamed from a run.
 *
 * ``run_id`` (the training_run_id) is stable for the whole run and is the join
 * key for downstream eval (argus-proof). ``type`` selects which fields are set:
 * ``start`` carries ``command`` + ``cwd``; ``log`` a line of trainer output in
 * ``message``; ``exit`` the ``returncode``; ``error`` a failure ``message``.
 * ``cancelled`` is the terminal event for a run stopped by request — distinct
 * from ``error`` so a consumer never mistakes a user cancel for a failure.
 */
export interface RunEvent {
  command?: string[] | null;
  cwd?: string | null;
  message?: string | null;
  returncode?: number | null;
  run_id: string;
  type: "start" | "log" | "exit" | "error" | "cancelled";
}
/**
 * POST /run — execute a forged trainer config by shelling out to its train.sh.
 */
export interface RunRequest {
  dry_run?: boolean;
  env?: {
    [k: string]: string;
  };
  export_dir: string;
  trainer: "kohya" | "onetrainer" | "diffusers";
}
/**
 * A run's status in the server's job registry (GET /run/{id}, GET /runs).
 *
 * Outlives the connection that started the run, so a caller can poll for the
 * terminal ``status`` + ``returncode`` (the argus-proof handoff) or reconnect
 * to the live stream by ``run_id`` long after the launching request is gone.
 */
export interface RunState {
  command?: string[];
  cwd?: string | null;
  ended_at?: string | null;
  export_dir: string;
  message?: string | null;
  returncode?: number | null;
  run_id: string;
  started_at: string;
  status: "running" | "succeeded" | "failed" | "cancelled";
  trainer: "kohya" | "onetrainer" | "diffusers";
}
/**
 * Catalogue entry for GET /trainers.
 */
export interface TrainerInfo {
  entrypoint?: string | null;
  files: string[];
  id: "kohya" | "onetrainer" | "diffusers";
  label: string;
  notes: string;
}
