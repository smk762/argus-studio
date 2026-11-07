/**
 * Wire types for the argus-curator API (:8101).
 *
 * Built from `@/lib/generated/curator`, which is generated from the curator's
 * pinned wire schema. That schema marks every field with a default as optional,
 * though the curator always sends them, so {@link Filled} names the ones this
 * app reads without a check. The types still written out here are wider than
 * the schema on purpose, and `@/lib/wire` fails typecheck if they stop fitting
 * it. The shared TargetProfile is the contract argus-lens inherits.
 */

import { guardBody } from "@/lib/curatorGuard";
import type * as Wire from "@/lib/generated/curator";
import type { Filled } from "@/lib/wire";

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

// Hand-written until argus-cortex exports the taxonomy (smk762/argus-cortex#29).
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
export const CONTENT_RATINGS = ["safe", "suggestive", "explicit"] as const;
export type ContentRating = (typeof CONTENT_RATINGS)[number];
export type AttributeSource = "fairface" | "mivolo";

export type TargetProfile = Required<Wire.TargetProfile>;

/** Curator's floor (argus-curator#114). A lower value fails ScanConfig validation. */
export const MIN_SHORT_SIDE = 512;

export function clampShortSide(n: number): number {
  if (!Number.isFinite(n)) return MIN_SHORT_SIDE;
  return Math.max(MIN_SHORT_SIDE, Math.round(n));
}

export type ScanConfig = Required<Wire.ScanConfig>;

/**
 * `fairface`, `mivolo`, `set_age` and `mivolo_body` each imply detection on the
 * curator, as {@link facesBody} repeats for the form.
 */
export type FaceConfig = Filled<Wire.FaceConfig, "enabled" | "model" | "min_det_score" | "cluster_eps" | "device">;

/** Places365 tags on whole images. */
export type SceneConfig = Required<Wire.SceneConfig>;

/**
 * SingGuard. `enabled` null means on whenever a URL is configured. A finished scan records true or false.
 * Hand-written: the schema closes `policy` to the names this release ships, but a server's own list comes from
 * `/detectors`, and `guardProblem` is what reports a name it doesn't offer.
 */
export interface GuardConfig {
  enabled?: boolean | null;
  /** The official verdict, and what the filters read by default. */
  policy: string;
  /** Extra policies to judge every image under: one more pass each. */
  variants: string[];
}

/** One entry of `GET /guard/policies` (curator 0.8). */
export interface GuardPolicyInfo {
  name: string;
  /** The name results record, such as `custom-<hash>` for a policy file. */
  recorded?: string | null;
  source?: string | null;
  /** Null when SingGuard applies its own rules, or the policy file cannot be read. */
  text?: string | null;
  error?: string | null;
}

/** Fashionpedia garments on whole images. Nothing under `min_conf` is recorded. */
export type GarmentConfig = Required<Wire.GarmentConfig>;

/** Opt-in drops after the identities phase. A match becomes a `prefilter:*` reject (curator 0.12). */
export type PrefilterConfig = Required<Wire.PrefilterConfig>;

/** A crop in pixels of the image as displayed, `right` and `bottom` exclusive. */
export type CropBox = Wire.CropBox;

/** One watermark hit: `[x, y, w, h]` in pixels of the uncropped frame. */
export type WatermarkDetection = Wire.WatermarkDetection;

/** Crops applied to the bytes in memory, never to the source (curator 0.14). */
export type CropConfig = Required<Wire.CropConfig>;

/** A MiVOLO (or FairFace) age on a face or a body-only person. Years count only from MiVOLO. */
export type AgeReading = Pick<Wire.FaceAttributes, "age_years" | "age_source">;

/**
 * Predicted attributes of a face, or an identity's pooled prediction. Each
 * `*_conf` is the chosen label's probability. A MiVOLO age is a regression, so
 * it sets `age_years`, `age` is its bracket, and `age_conf` is null.
 */
export type FaceAttributes = Wire.FaceAttributes;

/**
 * An age for a frame with no face, read off the set. An inference, not a reading of the frame.
 * Hand-written: only `years` is relied on, so the rest stay optional though the schema requires them.
 */
export interface SetAge {
  years: number;
  cluster_id?: string;
  faces?: number;
  share?: number;
}

/**
 * One person box. `face_index` null means no face matched, so any age is from the body alone.
 * Hand-written: this app doesn't read the box or its score, so it doesn't require them as the schema does.
 */
export interface PersonDetection extends AgeReading {
  bbox?: [number, number, number, number];
  det_score?: number;
  face_index?: number | null;
  age_body?: boolean | null;
  nsfw_labels?: Record<string, number>;
  exposed_score?: number;
}

export type SceneLabel = Wire.SceneLabel;

export type SceneTags = Filled<Wire.SceneTags, "categories">;

/** Hand-written: labels reach the rail and the filters as plain strings, and `color` stays optional. */
export interface GarmentDetection {
  label: string;
  conf: number;
  bbox: [number, number, number, number];
  /** The box reaches the frame edge, so the garment is likely cut off. */
  touches_edge?: boolean;
  color?: string;
}

export type FaceDetection = Filled<Wire.FaceDetection, "cluster_id" | "primary" | "yaw" | "pitch" | "pose">;

/**
 * NudeNet's reading of one image. Absent or null means the image was not scored.
 * This and the two below are hand-written: blurring is decided from them, so they
 * keep the absent and null cases the schema rules out and the checks still handle.
 */
export interface NsfwResult {
  exposed_score?: number | null;
  labels?: Record<string, number> | null;
  detections?: { label: string; score: number; bbox: [number, number, number, number] }[] | null;
}

/** EraX's own classes, not NudeNet's. */
export interface EraxResult {
  labels?: Record<string, number> | null;
  detections?: { label: string; score: number; bbox: [number, number, number, number] }[] | null;
}

/** A verdict, not a score: which rules fired, as this policy names them. */
export interface GuardResult {
  safe?: boolean;
  /** Full names from the verdict. A rule's letter differs by policy, so match on these. */
  rules?: string[] | null;
  explanation?: string | null;
  model?: string | null;
  /** The name recorded for the policy, which may be `custom-<hash>`. */
  policy?: string | null;
  /** The pass that decided it. */
  thinking?: string | null;
}

/**
 * Hand-written. Every check's field is optional and the moderation readings take
 * null, because an older curator leaves out what it doesn't know, and a frame
 * without its check must read as unchecked. `content_rating` is required in the
 * schema, and `people` can't be null there, so the generated type would lose that.
 */
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
  /** Read off `nsfw`. Null means not checked. */
  content_rating?: ContentRating | null;
  /** EraX. Null means not checked, or the check failed. */
  erax?: EraxResult | null;
  /** `nsfw` was filled from EraX because NudeNet did not score the frame. */
  erax_filled?: boolean;
  /** Policy verdict, once the guard check has run. Absent while it is pending. */
  guard?: GuardResult | null;
  /** Only when variants ran: every policy's verdict by name, the official one included. A missing name means that check failed. */
  guard_variants?: Record<string, GuardResult> | null;
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

/** `attributes` is pooled over every member face. */
export type FaceCluster = Filled<Wire.FaceCluster, "representative_bbox">;

/** Hand-written: a scan from an older curator can lack any `*_config`, which the schema rules out as null. */
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
  erax_config?: { enabled?: boolean | null } | null;
  guard_config?: GuardConfig | null;
  prefilter_config?: PrefilterConfig | null;
  crop_config?: CropConfig | null;
  results: ImageResult[];
  offset: number;
  limit: number | null;
  returned: number;
}

/** Transfer modes the curator accepts. Only `move` relocates (deletes) the source. */
export type ExportMode = "copy" | "symlink" | "move";

/**
 * Filters typed wider than the schema. It closes the first three to each label
 * set, but those values come from the results and from `/detectors`, so a name
 * this build doesn't know is the curator's to refuse. It also wants `guard_policies`
 * and `content_ratings` non-empty, which `listed` in curatorKeepSet ensures at
 * runtime by sending null, so no type here could say so.
 */
interface OpenFilters {
  garments?: string[] | null;
  exclude_garments?: string[] | null;
  guard_policies?: string[] | null;
  content_ratings?: ContentRating[] | null;
}

/**
 * Filter body for `POST /scan/{id}/select`: the filter fields of an export and
 * none of its transfer fields. That route never trims by diversity.
 */
export type SelectRequest = Filled<Omit<Wire.SelectRequest, keyof OpenFilters>, "min_score" | "keep_similar"> &
  OpenFilters;

/** Naming a `selection` makes the curator ignore every filter on the request. */
export type ExportRequest = Filled<
  Omit<Wire.ExportRequest, keyof OpenFilters>,
  "min_score" | "keep_similar" | "mode" | "preserve_structure" | "write_manifest"
> &
  OpenFilters;

/** Only an export can trim by diversity: `/select` never does, so a capped export goes without a `selection`. */
export type CapOptions = Pick<Wire.ExportRequest, "max_keep" | "diversify_scenes" | "diversify_outfits">;

/** `keep_reason` is empty when the image is kept, otherwise why it was left out. */
export type SelectRow = Filled<Wire.SelectRow, "keep_reason">;

export type SelectResult = Omit<Wire.SelectResult, "rows"> & { rows: SelectRow[] };

/**
 * `mode` is a union here though the wire says `str`: the two-locator rule branches on it.
 *
 * `manifest_version` was added to this payload *with* 2.1 (a manifest-2.0 curator
 * declares the version on each manifest row but not here), so its absence does
 * NOT mean pre-2.0, and the seam falls back to the presence of `exported_paths`
 * to tell 2.x from 1.x. Both stay optional for that reason, although the curator
 * sends them today.
 *
 * `exported_paths` maps rel_path to the path actually written under `dest`
 * (posix, relative to it), for the files whose transfer succeeded.
 * `exported_abs_paths` is the same mapping, absolute, so a consumer never joins
 * `dest` itself: a flattened export de-collides basenames into `stem-<hash>.ext`,
 * which no client can reproduce. It is absent on a 2.0 curator.
 *
 * `selected_rel_paths` is what the selection *chose*, before transfer. A file
 * there can still be missing from `exported_paths`, so it has no consumer, and
 * deliberately not one.
 */
export type ExportResult = Filled<Omit<Wire.ExportResult, "mode">, "manifest_path" | "captioned"> & {
  mode: ExportMode;
};

/**
 * One JSONL handoff-manifest row.
 *
 * `abs_path` is where the image can be *read*. Under `mode: "move"` the source
 * was deleted, so it equals `exported_abs_path`; otherwise it is the
 * still-present source. argus-lens opens rows strictly by this field.
 * `exported_path` is the normative relative locator (posix, relative to the
 * export root). `crop` is the box baked into the exported file, or null for the
 * source as it was.
 */
export type ManifestRow = Filled<
  Wire.ManifestRow,
  "manifest_version" | "primary_face_cluster" | "primary_face_pose" | "crop"
>;

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
  erax?: boolean;
  singguard?: boolean;
  /** Names a scan can pass as `guard.policy`. Empty without a server. */
  singguard_policies?: string[];
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
  guard: Pick<GuardConfig, "policy" | "variants">;
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
    guard: { policy: "default", variants: [] },
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
  const guard = guardBody(cfg.guard);
  return {
    folder,
    target_profile: cfg.profile,
    config: { ...cfg.config, min_short_side: clampShortSide(cfg.config.min_short_side) },
    faces: facesBody(cfg.faces),
    ...(cfg.scenes.enabled ? { scenes: cfg.scenes } : {}),
    ...(cfg.garments.enabled ? { garments: cfg.garments } : {}),
    ...(guard ? { guard } : {}),
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
  contentRatings: ContentRating[];
  /** Hide frames any listed policy judged unsafe. */
  guardUnsafe: boolean;
  /** Hide unsafe frames naming one of these full rule names. */
  guardRules: string[];
  /** Which policies the two above read. Empty is the official one. */
  guardPolicies: string[];
  /** View only: the curator has no such filter. */
  guardView: "all" | "unsafe" | "split" | "safe";
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
    contentRatings: [],
    guardUnsafe: false,
    guardRules: [],
    guardPolicies: [],
    guardView: "all",
  };
}
