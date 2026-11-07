/**
 * Wire types for the argus-curator API (:8101).
 *
 * These mirror `argus_curator.models` exactly — the curator emits these shapes
 * from POST /scan/folder and GET /scan/{id}, and consumes ExportRequest at
 * POST /export. The shared TargetProfile is the contract argus-lens inherits.
 */

/**
 * Version of the argus-curator handoff manifest. Mirrors
 * `argus_curator.models.MANIFEST_VERSION`; stamped on each row we build so the
 * payload matches what a live curator export writes.
 *
 * Rows exist only for files whose transfer actually succeeded, and each carries
 * `exported_path` — the normative relative locator. Consumers must use it rather
 * than re-deriving a destination from `rel_path` (flattened exports de-collide
 * basenames, so the two can differ).
 *
 * 2.1 adds `exported_abs_path` per row (and `exported_abs_paths` on the result),
 * so a row is self-contained: the manifest is often read outside the export root
 * it was written into (argus-lens receives it as an upload), and nothing else in
 * the row names that root to join `exported_path` onto. Major stays 2 — additive.
 *
 * 2.2 adds `crop` per row: the box baked into the exported file, or null when
 * the file is the source as it was. Also additive.
 */
export const MANIFEST_VERSION = "2.2";

export type TargetStyle = "photo" | "anime";
export type TargetCategory = "identity" | "wardrobe" | "pose_composition" | "setting";
export type FacePose = "frontal" | "three_quarter" | "profile";

export const FACE_POSES: FacePose[] = ["frontal", "three_quarter", "profile"];

export const POSE_LABELS: Record<FacePose, string> = {
  frontal: "Head-on",
  three_quarter: "3/4",
  profile: "Profile",
};

// FairFace and MiVOLO labels, in the curator's order. A model's prediction from
// appearance, not a fact about anyone.
export const FACE_RACES = [
  "white",
  "black",
  "latino_hispanic",
  "east_asian",
  "southeast_asian",
  "indian",
  "middle_eastern",
] as const;
export const FACE_GENDERS = ["male", "female"] as const;
export const FACE_AGES = ["0-2", "3-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70+"] as const;
export const SCENE_ENVIRONMENTS = ["indoor", "outdoor"] as const;

export type FaceRace = (typeof FACE_RACES)[number];
export type FaceGender = (typeof FACE_GENDERS)[number];
export type FaceAge = (typeof FACE_AGES)[number];
export type SceneEnvironment = (typeof SCENE_ENVIRONMENTS)[number];
export type AttributeSource = "fairface" | "mivolo";

export interface TargetProfile {
  target_style: TargetStyle;
  target_backend: string | null;
  checkpoint: string | null;
  target_category: TargetCategory;
}

/** Curator's floor (argus-curator#114). A lower value fails ScanConfig validation. */
export const MIN_SHORT_SIDE = 512;

export function clampShortSide(n: number): number {
  if (!Number.isFinite(n)) return MIN_SHORT_SIDE;
  return Math.max(MIN_SHORT_SIDE, Math.round(n));
}

export interface ScanConfig {
  min_short_side: number;
  max_aspect_ratio: number;
  blur_threshold: number;
  cluster_distance: number;
  weight_sharpness: number;
  weight_resolution: number;
  weight_artifact: number;
  weight_subject: number;
  sharpness_ref: number;
  resolution_ref: number;
  diversity_weight: number;
  max_workers: number;
}

export interface FaceConfig {
  enabled: boolean;
  model: string;
  min_det_score: number;
  cluster_eps: number;
  device: string;
  /** Race, gender and age bracket. Implies face detection on the curator. */
  fairface?: boolean;
  /** MiVOLO ages. Implies face detection on the curator. */
  mivolo?: boolean;
  /** Frames with no face take the set's age when one identity holds the scan. Implies MiVOLO. */
  set_age?: boolean;
  /** Give MiVOLO each face's body too, and age a body with no face. Implies MiVOLO. */
  mivolo_body?: boolean;
}

/** Places365 tags on whole images. */
export interface SceneConfig {
  enabled: boolean;
  top_k: number;
  device: string;
}

/** Fashionpedia garments on whole images. Nothing under `min_conf` is recorded. */
export interface GarmentConfig {
  enabled: boolean;
  min_conf: number;
  device: string;
}

/** Opt-in drops after the identities phase. A match becomes a `prefilter:*` reject (curator 0.12). */
export interface PrefilterConfig {
  drop_nsfw: boolean;
  drop_no_face: boolean;
  drop_no_age: boolean;
}

/** A crop in pixels of the image as displayed, `right` and `bottom` exclusive. */
export interface CropBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** One watermark hit: `[x, y, w, h]` in pixels of the uncropped frame. */
export interface WatermarkDetection {
  label: string;
  score: number;
  bbox: [number, number, number, number];
}

/** Crops applied to the bytes in memory, never to the source (curator 0.14). */
export interface CropConfig {
  enabled: boolean;
  /** Read `<image>.crop.json` beside each image. */
  sidecars: boolean;
  /** Inline boxes by rel_path. They beat a sidecar. This form has no editor for them. */
  boxes: Record<string, CropBox>;
  /** Send frames without a box by hand to the watermark detector. */
  detect: boolean;
  min_conf: number;
  /** Most of a side one edge may lose. Above 0 and below 0.5. */
  max_cut: number;
  /** Pixels cut beyond a hit's edge. */
  margin: number;
  /** A hit no edge cut removes rejects the frame as `crop:overlay`. */
  reject_overlay: boolean;
}

/** A MiVOLO (or FairFace) age on a face or a body-only person. Years count only from MiVOLO. */
export interface AgeReading {
  age_years?: number | null;
  age_source?: string | null;
}

/**
 * Predicted attributes of a face, or an identity's pooled prediction. Each
 * `*_conf` is the chosen label's probability. A MiVOLO age is a regression, so
 * it sets `age_years`, `age` is its bracket, and `age_conf` is null.
 */
export interface FaceAttributes extends AgeReading {
  race?: FaceRace | null;
  race_conf?: number | null;
  gender?: FaceGender | null;
  gender_conf?: number | null;
  gender_source?: AttributeSource | null;
  age?: FaceAge | null;
  age_conf?: number | null;
  /** MiVOLO read this face's body as well. */
  age_body?: boolean | null;
}

/** An age for a frame with no face, read off the set. An inference, not a reading of the frame. */
export interface SetAge {
  years: number;
  cluster_id?: string;
  faces?: number;
  share?: number;
}

/** One person box. `face_index` null means no face matched, so any age is from the body alone. */
export interface PersonDetection extends AgeReading {
  bbox?: [number, number, number, number];
  det_score?: number;
  face_index?: number | null;
  age_body?: boolean | null;
}

export interface SceneLabel {
  label: string;
  conf: number;
}

export interface SceneTags {
  /** Top-k labels, most probable first. */
  categories: SceneLabel[];
  environment: SceneEnvironment;
  environment_conf: number;
}

export interface GarmentDetection {
  label: string;
  conf: number;
  bbox: [number, number, number, number];
  /** The box reaches the frame edge, so the garment is likely cut off. */
  touches_edge?: boolean;
  color?: string;
}

export interface FaceDetection {
  bbox: [number, number, number, number]; // [x, y, w, h]
  det_score: number;
  cluster_id: string | null;
  primary: boolean;
  yaw: number | null;
  pitch: number | null;
  pose: FacePose | null;
  attributes?: FaceAttributes | null;
  /** Index into `ImageResult.people` when a person box was matched. */
  person_index?: number | null;
}

/** NudeNet's reading of one image. Absent or null means the image was not scored. */
export interface NsfwResult {
  exposed_score?: number | null;
  labels?: Record<string, number> | null;
}

export interface ImageResult {
  rel_path: string;
  abs_path: string;
  score: number;
  passed: boolean;
  reject_reason: string | null;
  similar_group: number;
  group_size: number;
  is_representative: boolean;
  is_duplicate: boolean;
  duplicate_of: string | null;
  keep_reason: string;
  sharpness: number;
  artifact_score: number;
  width: number;
  height: number;
  faces: FaceDetection[];
  face_count: number;
  primary_face_cluster: string | null;
  primary_face_pose: FacePose | null;
  primary_face_yaw: number | null;
  /** MiVOLO/FairFace attributes of the primary face, when that check ran. */
  primary_face_attributes?: FaceAttributes | null;
  /** Why detection failed here. With this set, `face_count` 0 means unchecked, not faceless. */
  face_error?: string | null;
  /** Set age standing in for a passing frame with no face of its own. */
  set_age?: SetAge | null;
  /** Person boxes. Body-only people (no matched face) keep a MiVOLO age that still counts. */
  people?: PersonDetection[] | null;
  /** How the person check went. Null means not asked for, or face detection failed first. */
  people_check?: "ok" | "detection_failed" | "body_ages_failed" | null;
  people_error?: string | null;
  /** Places365. Null means not run. */
  scene?: SceneTags | null;
  /** Fashionpedia, most confident first. Null means not run; empty means none found. */
  garments?: GarmentDetection[] | null;
  /** NudeNet. Null on a finished scan means not scored — never "clear". */
  nsfw?: NsfwResult | null;
  /** NudeNet failed and `nsfw` is EraX's hits alone, or nothing. */
  nudenet_failed?: boolean;
  /** Policy verdict, once the guard check has run. Absent while it is pending. */
  guard?: { safe?: boolean } | null;
  /** The crop every check saw, in the source's displayed pixels. `width`, `height` and every box are of the cropped frame. */
  crop?: CropBox | null;
  crop_source?: "manual" | "detected" | null;
  /** Hits on the uncropped frame. Empty means none found; null means not checked. */
  watermarks?: WatermarkDetection[] | null;
  phash: string;
  score_breakdown: Record<string, number>;
}

/**
 * CSS object-position that keeps the subject in frame when an image is
 * square-cropped (object-cover) in a thumbnail tile. Anchors on the primary
 * face's centre so heads aren't sliced off; falls back to an upper-centre bias
 * (where heads usually sit in portraits) when no face was detected.
 */
export function faceFocalPoint(img: ImageResult): string {
  const face = img.faces.find((f) => f.primary) ?? img.faces[0];
  if (face && img.width > 0 && img.height > 0) {
    const [x, y, w, h] = face.bbox;
    const clamp = (v: number) => Math.min(100, Math.max(0, v));
    const cx = clamp(((x + w / 2) / img.width) * 100);
    const cy = clamp(((y + h / 2) / img.height) * 100);
    return `${cx.toFixed(1)}% ${cy.toFixed(1)}%`;
  }
  return "50% 25%";
}

export interface FaceCluster {
  cluster_id: string;
  size: number;
  representative_rel_path: string;
  representative_bbox: [number, number, number, number] | null;
  /** Pooled over every member face. */
  attributes?: FaceAttributes | null;
}

export interface ScanSummary {
  scan_id: string;
  folder: string;
  target_profile: TargetProfile;
  config: ScanConfig;
  faces_config: FaceConfig;
  scenes_config?: SceneConfig | null;
  garments_config?: GarmentConfig | null;
  total: number;
  passed: number;
  rejected: number;
  duplicates: number;
  similar_clusters: number;
  reject_reasons: Record<string, number>;
  face_clusters: FaceCluster[];
  /** When `faces.set_age` asked: the age given to frames with no face, or why none was. */
  set_age?: SetAge | null;
  set_age_skipped?: string | null;
  /** What the finished scan actually ran. `enabled: true` means NudeNet scored it. */
  nsfw_config?: { enabled?: boolean | null } | null;
  prefilter_config?: PrefilterConfig | null;
  crop_config?: CropConfig | null;
  results: ImageResult[];
  offset: number;
  limit: number | null;
  returned: number;
}

/** Transfer modes the curator accepts. Only `move` relocates (deletes) the source. */
export type ExportMode = "copy" | "symlink" | "move";

export interface ExportRequest extends SelectRequest, CapOptions {
  scan_id?: string | null;
  /** Naming a selection makes the curator ignore every filter on this request. */
  selection?: string[] | null;
  dest: string;
  mode: "copy" | "symlink" | "move";
  preserve_structure: boolean;
  write_manifest: boolean;
  caption_url?: string | null;
  /** Write `<file>.xmp` beside each exported file (curator 0.9). */
  write_xmp?: boolean;
  /** Person names by face cluster id, for the XMP regions. Unnamed clusters stay unnamed. */
  face_names?: Record<string, string> | null;
  /** Bring `.txt`, `.xmp` and `.json` sidecars along (curator 0.13, `/health.export_sidecars`). */
  carry_sidecars?: boolean;
  /** Opaque JSON written to `<dest>/run_stats.json` (same gate). */
  run_stats?: Record<string, unknown> | null;
}

/**
 * Filter body for `POST /scan/{id}/select`: the filter fields of an export and
 * none of its transfer fields. That route never trims by diversity.
 */
export interface SelectRequest {
  min_score: number;
  keep_similar: boolean;
  face_clusters?: string[] | null;
  face_poses?: FacePose[] | null;
  face_races?: FaceRace[] | null;
  face_genders?: FaceGender[] | null;
  face_ages?: FaceAge[] | null;
  min_age_years?: number | null;
  max_age_years?: number | null;
  min_attribute_conf?: number;
  scenes?: string[] | null;
  scene_environments?: SceneEnvironment[] | null;
  min_scene_conf?: number;
  garments?: string[] | null;
  exclude_garments?: string[] | null;
  min_garment_conf?: number;
  garments_uncropped?: boolean;
}

/** Only an export can trim by diversity: `/select` never does, so a capped export goes without a `selection`. */
export interface CapOptions {
  max_keep?: number | null;
  diversify_scenes?: boolean;
  diversify_outfits?: boolean;
}

export interface SelectRow {
  rel_path: string;
  abs_path: string;
  /** Empty when the image is kept, otherwise why it was left out. */
  keep_reason: string;
}

export interface SelectResult {
  scan_id: string;
  total: number;
  kept: number;
  rows: SelectRow[];
}

export interface ExportResult {
  /**
   * Manifest contract version this curator writes (e.g. `"2.1"`). Added to this
   * payload *with* 2.1 — a manifest-2.0 curator declares the version on each
   * manifest row but not here — so its absence does NOT mean pre-2.0, and the
   * seam falls back to the presence of `exported_paths` to tell 2.x from 1.x.
   */
  manifest_version?: string;
  manifest_path: string | null;
  copied: number;
  skipped: number;
  dest: string;
  /** Union rather than `string`: the two-locator rule below branches on it. */
  mode: ExportMode;
  /**
   * What the selection *chose*, before transfer — a file here can still be
   * missing from `exported_paths` because its source vanished or the copy
   * failed. Mirrors the curator's field; no consumer, and deliberately not one:
   * use `exported_paths` for what actually landed.
   */
  selected_rel_paths?: string[];
  captioned: boolean;
  /**
   * rel_path -> the path actually written under `dest` (posix, relative to it),
   * for the files whose transfer succeeded. Manifest 2.0+. Its *presence* is
   * what distinguishes a 2.x result from a pre-2.0 one, which is why the seam
   * refuses rather than defaulting when it is missing.
   */
  exported_paths?: Record<string, string>;
  /**
   * The same mapping, absolute — so a consumer never joins `dest` itself (a
   * flattened export de-collides basenames into `stem-<hash>.ext`, which no
   * client can reproduce). Manifest 2.1; absent on a 2.0 curator.
   */
  exported_abs_paths?: Record<string, string>;
  /** Sidecars written beside exported files (`write_xmp`). */
  xmp_written?: number;
  /** Sidecar files transferred with their images (`carry_sidecars`). One image can carry several. */
  sidecars_carried?: number;
  /** Sidecars that failed. Their images still landed; the curator's log names them. */
  sidecars_failed?: number;
  /** Exported images written cropped, counted in `copied` too. */
  cropped?: number;
  /** Null when the request carried none, nothing was exported, or the write failed. */
  run_stats_path?: string | null;
}

/**
 * One JSONL handoff-manifest row — mirrors `argus_curator.models.ManifestRow`
 * (published as ManifestRow in the curator's schema/curator-wire.schema.json).
 */
export interface ManifestRow {
  manifest_version: string;
  rel_path: string;
  /**
   * Where the image can be *read*. Under `mode: "move"` the source was deleted,
   * so this is the destination (equals `exported_abs_path`); otherwise it is the
   * still-present source. argus-lens opens rows strictly by this field.
   */
  abs_path: string;
  /** Posix, relative to the export root. The normative relative locator. */
  exported_path: string;
  /** Absolute location of the written file, so the row stands alone (2.1). */
  exported_abs_path: string;
  target_profile: TargetProfile;
  primary_face_cluster: string | null;
  primary_face_pose: FacePose | null;
  score: number;
  similar_group: number;
  /** The box baked into the exported file (2.2), or null for the source as it was. */
  crop: CropBox | null;
}

export interface Detectors {
  torch: boolean;
  cuda: boolean;
  clip: boolean;
  insightface: boolean;
  onnxruntime: boolean;
  /** Absent on a curator older than the check. */
  fairface?: boolean;
  mivolo?: boolean;
  /** InsightFace's person detector, for `faces.mivolo_body`. */
  bodies?: boolean;
  places365?: boolean;
  garments?: boolean;
  /** A NudeNet URL is set. Reachability is not probed. */
  nudenet?: boolean;
  /** A watermark detector URL is set. Reachability is not probed, so a scan can still get a 503. */
  watermark?: boolean;
}

export interface FolderEntry {
  name: string;
  rel_path: string;
  abs_path: string;
  image_count: number;
  subfolder_count: number;
}

export interface FolderListing {
  root: string;
  path: string;
  abs_path: string;
  parent: string | null;
  direct_image_count: number;
  folders: FolderEntry[];
}

// ── UI-facing config (the subset the config panel edits) ────────────────────

export const TARGET_CATEGORIES: TargetCategory[] = [
  "identity",
  "wardrobe",
  "pose_composition",
  "setting",
];

/**
 * Curator category -> argus-lens caption category (argus-studio#67 hand-off).
 *
 * Lens's categories are a superset of the curator's four, under the same names
 * (lens adds `lighting` and `action`), so this is the identity map. It stays a
 * map so a future divergence has one place to land. Lens does not validate the
 * category: an unknown value yields an EMPTY caption (argus-studio#102), which
 * is why the old `pose_composition -> pose_gaze` mapping broke the hand-off.
 */
export const LENS_CATEGORY: Record<TargetCategory, string> = {
  identity: "identity",
  wardrobe: "wardrobe",
  pose_composition: "pose_composition",
  setting: "setting",
};

export const CATEGORY_LABELS: Record<TargetCategory, string> = {
  identity: "Identity",
  wardrobe: "Wardrobe",
  pose_composition: "Pose / Composition",
  setting: "Setting",
};

export const CATEGORY_DESCRIPTIONS: Record<TargetCategory, string> = {
  identity: "Person / character LoRA — strict blur floor, rewards a single centred face.",
  wardrobe: "Clothing / outfit LoRA — prefers full-body framing, looser face penalty.",
  pose_composition: "Pose LoRA — biases toward framing variety, stronger diversity pressure.",
  setting: "Scene LoRA — rewards wide framing and high resolution, minimal face penalty.",
};

export const CATEGORY_COLORS: Record<TargetCategory, string> = {
  identity: "accent-purple",
  wardrobe: "accent-green",
  pose_composition: "accent-teal",
  setting: "accent-orange",
};

/** Framing guidance shown under the category picker — what to feed the trainer. */
export const CATEGORY_COMPOSITION_TIPS: Record<TargetCategory, string> = {
  identity:
    "The face is the concept: favour clear, sharp face shots at varied angles (head-on, 3/4, profile) and expressions, plus a few half/full-body frames where the face is still visible. Faceless crops don't teach identity — enable Face Clustering, then filter with “Require a known face”.",
  wardrobe:
    "Show the full outfit: prefer full/half-body framing over close-ups. A visible face helps, but the garment should be the focus and well-lit from multiple angles.",
  pose_composition:
    "Prioritise variety of pose and framing over a single subject. Mix wide and tight crops; the body/gesture matters more than a pristine face.",
  setting:
    "Reward wide, high-resolution scenes. Faces are incidental — keep establishing shots and environments; drop tight portraits.",
};

/**
 * Ideal training-set size for an SDXL LoRA, per category. Identity/character
 * concepts converge on ~15–30 sharp, varied images; broader concepts benefit
 * from a bit more variety. These are guidelines, not hard limits.
 */
export interface DatasetSizeGuide {
  ideal: string;
  low: number; // below this = too few
  hi: number; // above this = getting large
}

export const DATASET_SIZE_GUIDE: Record<TargetCategory, DatasetSizeGuide> = {
  identity: { ideal: "15–30", low: 12, hi: 50 },
  wardrobe: { ideal: "20–40", low: 15, hi: 60 },
  pose_composition: { ideal: "20–40", low: 15, hi: 60 },
  setting: { ideal: "25–50", low: 15, hi: 80 },
};

/**
 * Suggested kohya-style SDXL LoRA training params derived from the selected
 * subset size and target category. These are sensible starting points, not
 * gospel — the repeats/epochs are solved to land near a category-appropriate
 * total step count so small sets train longer per image and large sets don't
 * overcook.
 */
export interface TrainingParams {
  images: number;
  repeats: number;
  epochs: number;
  totalSteps: number;
  networkDim: number;
  networkAlpha: number;
  unetLr: string;
  textEncoderLr: string;
  optimizer: string;
  scheduler: string;
  resolution: number;
  batchSize: number;
  precision: string;
}

interface CategoryTrainingBias {
  targetSteps: number;
  dim: number;
  alpha: number;
}

const TRAINING_BIAS: Record<TargetCategory, CategoryTrainingBias> = {
  identity: { targetSteps: 1500, dim: 16, alpha: 8 },
  wardrobe: { targetSteps: 1600, dim: 16, alpha: 8 },
  pose_composition: { targetSteps: 1800, dim: 32, alpha: 16 },
  setting: { targetSteps: 2000, dim: 32, alpha: 16 },
};

export function suggestTrainingParams(count: number, category: TargetCategory): TrainingParams {
  const bias = TRAINING_BIAS[category];
  const epochs = 10;
  const n = Math.max(1, count);
  const repeats = Math.max(1, Math.round(bias.targetSteps / (n * epochs)));
  return {
    images: count,
    repeats,
    epochs,
    totalSteps: count * repeats * epochs,
    networkDim: bias.dim,
    networkAlpha: bias.alpha,
    unetLr: "1e-4",
    textEncoderLr: "5e-5",
    optimizer: "AdamW8bit",
    scheduler: "cosine",
    resolution: 1024,
    batchSize: 2,
    precision: "bf16",
  };
}

export type DatasetSizeTone = "empty" | "low" | "good" | "high";

export function datasetSizeStatus(
  count: number,
  category: TargetCategory,
): { tone: DatasetSizeTone; text: string } {
  const g = DATASET_SIZE_GUIDE[category];
  if (count === 0) {
    return { tone: "empty", text: `Aim for ~${g.ideal} sharp, varied images for an SDXL ${CATEGORY_LABELS[category]} LoRA.` };
  }
  if (count < g.low) {
    return { tone: "low", text: `${count} selected — light for SDXL; ~${g.ideal} usually trains a stronger, more flexible LoRA.` };
  }
  if (count > g.hi) {
    return { tone: "high", text: `${count} selected — more than needed. Trimming to your best ~${g.ideal} keeps the concept clean.` };
  }
  return { tone: "good", text: `${count} selected — in the ~${g.ideal} sweet spot for an SDXL ${CATEGORY_LABELS[category]} LoRA.` };
}

/** The editable slice of the scan request the panel manages. */
export interface CuratorConfig {
  profile: TargetProfile;
  config: ScanConfig;
  faces: FaceConfig;
  scenes: SceneConfig;
  garments: GarmentConfig;
  prefilter: PrefilterConfig;
  crops: CropConfig;
}

export function defaultScanConfig(): ScanConfig {
  return {
    min_short_side: 512,
    max_aspect_ratio: 3.0,
    blur_threshold: 100.0,
    cluster_distance: 10,
    weight_sharpness: 0.35,
    weight_resolution: 0.3,
    weight_artifact: 0.15,
    weight_subject: 0.2,
    sharpness_ref: 800.0,
    resolution_ref: 1024,
    diversity_weight: 0.4,
    max_workers: 4,
  };
}

export function defaultPrefilter(): PrefilterConfig {
  return { drop_nsfw: false, drop_no_face: false, drop_no_age: false };
}

export function defaultCrops(): CropConfig {
  return {
    enabled: false,
    sidecars: true,
    boxes: {},
    detect: false,
    min_conf: 0.4,
    max_cut: 0.15,
    margin: 4,
    reject_overlay: true,
  };
}

export function defaultCuratorConfig(): CuratorConfig {
  return {
    profile: {
      target_style: "photo",
      target_backend: "sdxl",
      checkpoint: null,
      target_category: "identity",
    },
    config: defaultScanConfig(),
    faces: {
      enabled: false,
      model: "buffalo_l",
      min_det_score: 0.5,
      cluster_eps: 0.5,
      device: "auto",
      fairface: false,
      mivolo: false,
      set_age: false,
      mivolo_body: false,
    },
    scenes: { enabled: false, top_k: 5, device: "auto" },
    garments: { enabled: false, min_conf: 0.3, device: "auto" },
    prefilter: defaultPrefilter(),
    crops: defaultCrops(),
  };
}

export function prefilterOn(prefilter: PrefilterConfig): boolean {
  return prefilter.drop_nsfw || prefilter.drop_no_face || prefilter.drop_no_age;
}

/** The implications the curator's FaceConfig validator applies, so the form and the record agree. */
export function facesBody(faces: FaceConfig): FaceConfig {
  const mivolo = faces.mivolo === true || faces.set_age === true || faces.mivolo_body === true;
  return { ...faces, mivolo, enabled: faces.enabled || faces.fairface === true || mivolo };
}

/**
 * Build the POST /scan/folder request body from the editable config. `prefilter`,
 * `crops`, `scenes` and `garments` go only when asked for: a curator too old to
 * know one ignores the block, and the scan would quietly run without it.
 */
export function buildScanBody(folder: string, cfg: CuratorConfig): Record<string, unknown> {
  return {
    folder,
    target_profile: cfg.profile,
    config: { ...cfg.config, min_short_side: clampShortSide(cfg.config.min_short_side) },
    faces: facesBody(cfg.faces),
    ...(cfg.scenes.enabled ? { scenes: cfg.scenes } : {}),
    ...(cfg.garments.enabled ? { garments: cfg.garments } : {}),
    ...(prefilterOn(cfg.prefilter) ? { prefilter: cfg.prefilter } : {}),
    ...(cfg.crops.enabled ? { crops: cfg.crops } : {}),
  };
}

// ── Left-rail facets (client-side filtering of the results grid) ────────────

export interface CuratorFilters {
  /** Selected face clusters (empty = all identities). */
  faceClusters: string[];
  /** Selected primary-face poses (empty = all orientations). */
  poses: FacePose[];
  minScore: number;
  passedOnly: boolean;
  /** Hide non-representative near-duplicates. */
  hideDuplicates: boolean;
  /** Keep only images with exactly one detected face. */
  singleFaceOnly: boolean;
  /** Drop images with no recognised face (primary_face_cluster == null). */
  requireKnownFace: boolean;
  /** Primary-face predictions. Empty means all. A frame without the reading drops out once one is set. */
  faceRaces: FaceRace[];
  faceGenders: FaceGender[];
  faceAges: FaceAge[];
  minAgeYears: number | null;
  maxAgeYears: number | null;
  minAttributeConf: number;
  scenes: string[];
  sceneEnvironments: SceneEnvironment[];
  minSceneConf: number;
  garments: string[];
  excludeGarments: string[];
  minGarmentConf: number;
  /** With `garments`: a match must clear the frame edge. */
  garmentsUncropped: boolean;
}

export function defaultFilters(): CuratorFilters {
  return {
    faceClusters: [],
    poses: [],
    minScore: 0,
    passedOnly: false,
    hideDuplicates: false,
    singleFaceOnly: false,
    requireKnownFace: false,
    faceRaces: [],
    faceGenders: [],
    faceAges: [],
    minAgeYears: null,
    maxAgeYears: null,
    minAttributeConf: 0,
    scenes: [],
    sceneEnvironments: [],
    minSceneConf: 0.1,
    garments: [],
    excludeGarments: [],
    minGarmentConf: 0.5,
    garmentsUncropped: false,
  };
}
