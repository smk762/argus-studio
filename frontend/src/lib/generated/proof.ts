// Generated from smk762/argus-proof@v0.2.2 schema/proof-wire.schema.json.
// Do not edit: change schema/pins.json and run `npm run wire:pull`.

export interface ProofWire {
  AcceptanceThresholds?: AcceptanceThresholds;
  AggregateScores?: AggregateScores;
  BackendCapabilities?: BackendCapabilities;
  EvalReport?: EvalReport;
  GateCheck?: GateCheck;
  GateConfig?: GateConfig;
  GateResult?: GateResult;
  GeneratedImage?: GeneratedImage;
  GridConfig?: GridConfig;
  GridEstimate?: GridEstimate;
  GridPlan?: GridPlan;
  ImageScores?: ImageScores;
  LoRARef?: LoRARef;
  LoRASpec?: LoRASpec;
  MetricScores?: MetricScores;
  ModelRef?: ModelRef;
  ProgressEvent?: ProgressEvent;
  Refinement?: Refinement;
  RejectArchive?: RejectArchive;
  RejectReason?: RejectReason;
  RejectRecord?: RejectRecord;
  RunManifest?: RunManifest;
  RunSpec?: RunSpec;
  SamplingParams?: SamplingParams;
  ScorerProvenance?: ScorerProvenance;
  Verdict?: Verdict;
}
/**
 * Declared thresholds a run must clear to be accepted (the CI gate, #12).
 *
 * Turns "was this LoRA/dataset good enough?" into an automatable yes/no. Each
 * check runs only when its threshold is set; ``min_pass_rate`` is **on by
 * default** (set it ``None`` to skip), the rest default off. If no check is
 * configured the gate rejects rather than accept on zero evidence.
 * ``min_pass_rate_ci_lower`` is the stricter, small-N-safe version of
 * ``min_pass_rate`` — the Wilson lower bound must clear it, so a lucky 3/3
 * doesn't pass a bar that 300/400 would. ``max_unsafe_rate`` counts an image
 * unsafe when its ``safety`` metric is below ``unsafe_safety_floor`` or it
 * carries an ``unsafe`` reject reason.
 */
export interface AcceptanceThresholds {
  confidence?: number;
  max_unsafe_rate?: number | null;
  min_identity_mean?: number | null;
  min_pass_rate?: number | null;
  min_pass_rate_ci_lower?: number | null;
  unsafe_safety_floor?: number;
}
/**
 * Run-level roll-up: counts, pass rate, mean of each metric axis, diversity.
 *
 * ``pass_rate`` is computed over near-duplicate *groups*, not raw frames, so a
 * cluster of Monte-Carlo near-dups counts once: ``n_passed / n_groups``.
 * ``n_groups`` equals ``n_images`` when no deduper ran.
 */
export interface AggregateScores {
  diversity?: number | null;
  means?: MetricScores;
  n_groups?: number | null;
  n_images: number;
  n_needs_hitl?: number;
  n_passed: number;
  pass_rate: number;
}
/**
 * The scoring axes for one image (or their means, in the aggregate).
 *
 * Every field is optional so an axis whose scorer did not run stays ``None``
 * instead of a misleading ``0.0``. Semantics: ``identity`` similarity to the
 * reference (higher = closer), ``clip_score`` prompt adherence, ``aesthetic``
 * an IQA/aesthetic score, ``preference`` an ImageReward/HPS-style score, and
 * ``safety`` a safety score.
 */
export interface MetricScores {
  aesthetic?: number | null;
  clip_score?: number | null;
  identity?: number | null;
  preference?: number | null;
  safety?: number | null;
}
/**
 * What a generation backend can do — its capability descriptor.
 *
 * Lets a caller pick or validate a backend without hard-coding which one it
 * is: swapping backends is a config change, not a code change.
 */
export interface BackendCapabilities {
  max_loras?: number | null;
  name: string;
  reads_pnginfo?: boolean;
  streams_progress?: boolean;
  supports_seed_set?: boolean;
}
/**
 * Scored evaluation of a generation run: per-image + aggregate + verdict.
 *
 * Links to its :class:`RunManifest` by ``run_id`` rather than embedding it, so
 * the run dir stays the single source of truth for generation params.
 */
export interface EvalReport {
  aggregate: AggregateScores;
  created_at?: string | null;
  images?: ImageScores[];
  proof_version?: string;
  run_id: string;
  scorers?: ScorerProvenance[];
  verdict: Verdict;
}
/**
 * Per-image scores for one generated sample, keyed by ``(run_id, seed)``.
 *
 * ``image_id`` is an opaque handle for the report to reference; the durable,
 * reproducible key is ``seed`` (with the run's :class:`RunManifest`).
 * ``hitl_rating`` is a 1–5 star human rating when review has happened;
 * ``hitl_rater`` records who gave it (an opaque rater id) so a report can be
 * split per rater for inter-rater reliability. ``refinement`` is the optional
 * second-pass re-rank over the passing subset, kept distinct from the first pass.
 */
export interface ImageScores {
  duplicate_group?: number | null;
  hitl_rater?: string | null;
  hitl_rating?: number | null;
  image_id: string;
  metrics?: MetricScores;
  passed?: boolean | null;
  refinement?: Refinement | null;
  reject_reasons?: RejectReason[];
  seed: number;
}
/**
 * A second-pass refined rating for one image (the optional refinement stage).
 *
 * A finer 1–5 re-rank of the images that *already passed* the quality stage,
 * with free-text ``notes`` — a **separate layer** from the first-pass
 * ``hitl_rating``/``reject_reasons`` (it never overwrites them), so both the
 * original verdict and the refined ordering are retained. ``rater`` records who
 * refined it.
 */
export interface Refinement {
  notes?: string | null;
  rank: number;
  rater?: string | null;
}
/**
 * One structured reason an image was rejected or flagged.
 *
 * ``category`` optionally attributes an ``unsafe`` reject to a policy-taxonomy
 * slug (violence / hate / self_harm / weapons / sexual …, see
 * :mod:`argus_proof.moderation`), so a reviewer's flag can be sliced by category
 * rather than lumped into one "unsafe". Kept a free ``str`` (not a Literal) so
 * the taxonomy can evolve without a wire-contract break.
 */
export interface RejectReason {
  category?: string | null;
  code:
    | "identity_mismatch"
    | "prompt_mismatch"
    | "low_quality"
    | "anatomy"
    | "artifact"
    | "duplicate"
    | "overfit"
    | "unsafe"
    | "other";
  note?: string | null;
}
/**
 * Where a score came from: the scorer, its version, and the model it used.
 *
 * Recorded for every scorer that contributed to an :class:`EvalReport` so a
 * result is auditable and reproducible — a score is only as trustworthy as the
 * model and version that produced it.
 */
export interface ScorerProvenance {
  metric: string;
  model?: string | null;
  name: string;
  version?: string | null;
}
/**
 * The automated pass/fail decision for a run, with the reasons behind it.
 *
 * ``passed`` reflects the automated scoring alone (groups that auto-passed).
 * ``pending`` is True when the run hasn't cleared the bar yet but un-reviewed
 * HITL groups could still push it over once rated — so a caller can tell
 * "failed" apart from "not judged yet" instead of reading a premature fail.
 */
export interface Verdict {
  passed: boolean;
  pending?: boolean;
  reasons?: string[];
}
/**
 * One threshold check's outcome, with the actual value vs the threshold.
 */
export interface GateCheck {
  actual?: number | null;
  detail?: string;
  name: string;
  passed: boolean;
  threshold?: number | null;
}
/**
 * Thresholds that route each image to auto-pass / auto-fail / needs-HITL.
 *
 * An automated pre-pass so humans only rate the borderline band (HITL doesn't
 * scale to every image). Scorers return a normalised score in ``[0, 1]``
 * (higher = better); the gate takes a ``weights``-weighted mean of the metrics
 * present (curator's weighted ``score_breakdown`` pattern) into a composite:
 * ``composite >= auto_pass`` → pass, ``<= auto_fail`` → fail, between → HITL.
 * ``hard_gates`` are absolute per-metric floors (e.g. a minimum identity) that
 * fail an image regardless of composite. A run passes when its group pass-rate
 * reaches ``run_pass_rate``.
 *
 * ``safety`` is in the default composite weights so an unsafe image is dragged
 * down once safety scoring lands (Phase 4); for a true veto, add ``safety`` to
 * ``hard_gates`` with your scorer's floor — the composite alone can let a
 * high-quality-but-unsafe image through.
 */
export interface GateConfig {
  auto_fail?: number;
  auto_pass?: number;
  hard_gates?: {
    [k: string]: number;
  };
  run_pass_rate?: number;
  weights?: {
    [k: string]: number;
  };
}
/**
 * The overall accept/reject decision — ``passed`` iff every check passed.
 */
export interface GateResult {
  checks?: GateCheck[];
  passed: boolean;
}
/**
 * One image a backend produced, ready to be scored.
 *
 * ``image_id`` is the opaque handle scores reference; ``(run_id, seed)`` is the
 * reproducible key. ``pnginfo`` is the metadata read back from the PNG the
 * engine embedded (ComfyUI PNGInfo), so the recorded params can be checked
 * against what actually rendered rather than trusted blind.
 */
export interface GeneratedImage {
  height: number;
  image_id: string;
  path: string;
  pnginfo?: {
    [k: string]: string;
  };
  run_id: string;
  seed: number;
  width: number;
}
/**
 * One grid: the :class:`GridAxes` under a **fixed** base checkpoint + sampler.
 *
 * Base prompts come from the export's captions (the zeroshot caption variant,
 * falling back to the training ``.txt`` sidecar). Those are multiplied across
 * the inherited axes into a deterministic, reproducible set of
 * :class:`RunSpec`s; a control ``seeds`` set is shared by every run so seed luck
 * can't skew a comparison.
 */
export interface GridConfig {
  base_checkpoint: string;
  combo_seed?: number;
  flexibility_prompts?: string[];
  /**
   * @minItems 1
   */
  lora_checkpoints: [string, ...string[]];
  /**
   * @minItems 1
   */
  lora_weights?: [number, ...number[]];
  max_base_prompts?: number | null;
  max_token_combos?: number | null;
  negative_prompt?: string;
  run_id_prefix?: string;
  sampling: SamplingParams;
  seconds_per_image?: number;
  /**
   * @minItems 1
   */
  seeds: [number, ...number[]];
  source_manifest?: string | null;
  source_manifest_version?: string | null;
  token_axes?: {
    [k: string]: string[];
  };
  training_run_id?: string | null;
}
/**
 * The sampler knobs that, with the seed-set, make a run reproducible.
 */
export interface SamplingParams {
  cfg: number;
  clip_skip?: number;
  height: number;
  sampler: string;
  scheduler: string;
  steps: number;
  width: number;
}
/**
 * The up-front count + GPU-hour estimate reported before any generation.
 *
 * ``axes`` breaks the grid down (how many checkpoints × weights × prompts ×
 * seeds) so a caller sees why the count is what it is before committing GPU.
 */
export interface GridEstimate {
  axes?: {
    [k: string]: number;
  };
  est_gpu_hours: number;
  est_gpu_seconds: number;
  n_images: number;
  n_runs: number;
  seconds_per_image: number;
}
/**
 * A fully enumerated grid: the runs to generate plus their cost estimate.
 */
export interface GridPlan {
  estimate: GridEstimate;
  run_id_prefix: string;
  specs?: RunSpec[];
}
/**
 * A generation request: what to generate, before a backend resolves it.
 *
 * The prompt-grid builder (issue #3) emits a list of these; a
 * :class:`~argus_proof.backends.base.GenBackend` turns one into images plus the
 * resolved :class:`RunManifest`. Models are named (not yet hashed): the backend
 * resolves each name to a file and records its SHA256 in the manifest.
 *
 * ``seeds`` is the seed strategy made concrete — one fixed seed for a
 * within-checkpoint sweep, or a fixed seed-set (so seed luck averages out) for
 * a cross-checkpoint comparison. One image is produced per seed.
 */
export interface RunSpec {
  base_checkpoint: string;
  loras?: LoRASpec[];
  negative_prompt?: string;
  prompt: string;
  run_id: string;
  sampling: SamplingParams;
  /**
   * @minItems 1
   */
  seeds: [number, ...number[]];
  source_manifest?: string | null;
  source_manifest_version?: string | null;
  training_run_id?: string | null;
  vae?: string | null;
}
/**
 * A LoRA to apply, as *requested* — name + weight, before the file is hashed.
 *
 * The request-time counterpart of :class:`LoRARef`: a :class:`RunSpec` names a
 * LoRA by filename; the backend resolves it to a file, hashes it, and records
 * the resulting :class:`LoRARef` in the :class:`RunManifest`.
 */
export interface LoRASpec {
  name: string;
  weight?: number;
}
/**
 * A LoRA applied during generation, as recorded in a resolved run: a
 * :class:`ModelRef` (name pinned by SHA256) plus its weight.
 */
export interface LoRARef {
  name: string;
  /**
   * lowercase hex SHA256 digest
   */
  sha256: string;
  weight?: number;
}
/**
 * A model file pinned by content: how the engine names it + its SHA256.
 *
 * ``name`` is what the generation engine loads (e.g. a ComfyUI checkpoint
 * filename); ``sha256`` is the real identity, so a manifest can't drift if the
 * file behind the name changes.
 */
export interface ModelRef {
  name: string;
  /**
   * lowercase hex SHA256 digest
   */
  sha256: string;
}
/**
 * One NDJSON progress line streamed during generation (suite convention).
 *
 * ``type`` selects which fields matter: ``start`` sets ``total`` (images to
 * make); ``progress`` sets ``completed``/``total``; ``image`` sets ``seed`` +
 * ``image_id`` as each finishes; ``done`` closes the run; ``error`` carries a
 * failure ``message``.
 */
export interface ProgressEvent {
  completed?: number | null;
  image_id?: string | null;
  message?: string | null;
  run_id: string;
  seed?: number | null;
  total?: number | null;
  type: "start" | "progress" | "image" | "done" | "error";
}
/**
 * Metadata-only archive of rejected/flagged outputs — zero image references.
 *
 * ``manifests`` (keyed by ``run_id``) carries the full generation params for
 * every run a record came from, so the archive is self-describing: you can see
 * exactly what produced a bad output without keeping the output itself. Both
 * :class:`RunManifest` and :class:`RejectRecord` are image-free by
 * construction, so the archive retains no image or thumbnail paths.
 */
export interface RejectArchive {
  manifests?: {
    [k: string]: RunManifest;
  };
  proof_version?: string;
  records?: RejectRecord[];
}
/**
 * A fully reproducible generation run: everything needed to recreate it.
 *
 * ``seeds`` is the seed strategy made concrete — a single fixed seed for a
 * within-checkpoint sweep is a one-element list; a fixed seed-set (so seed luck
 * averages out across a cross-checkpoint comparison) is an N-element list.
 * Each generated image is identified by ``(run_id, seed)``.
 *
 * ``source_manifest`` links back to the curator export ``manifest.jsonl`` the
 * LoRA was trained from, and ``training_run_id`` (optional) is the forge
 * ``training_run_id`` / ``RunEvent.run_id`` join key when the LoRA came through
 * the suite rather than being supplied ad hoc.
 */
export interface RunManifest {
  base_checkpoint: ModelRef;
  created_at?: string | null;
  engine: string;
  engine_version: string;
  loras?: LoRARef[];
  negative_prompt?: string;
  prompt: string;
  proof_version?: string;
  run_id: string;
  sampling: SamplingParams;
  /**
   * @minItems 1
   */
  seeds: [number, ...number[]];
  source_manifest?: string | null;
  source_manifest_version?: string | null;
  training_run_id?: string | null;
  vae?: ModelRef | null;
}
/**
 * One rejected/flagged output, described without retaining its image.
 *
 * Keyed by ``(run_id, seed)``: the seed plus the run's :class:`RunManifest`
 * reconstructs the exact image on demand, so nothing about the pixels needs to
 * be stored. There is deliberately no path, thumbnail, or image field here —
 * that is the whole point of the archive.
 */
export interface RejectRecord {
  hitl_rating?: number | null;
  metrics?: MetricScores;
  rater_id?: string | null;
  reasons?: RejectReason[];
  run_id: string;
  seed: number;
}
