/**
 * Wire types for the argus-curator API (:8101).
 *
 * These mirror `argus_curator.models` exactly — the curator emits these shapes
 * from POST /scan/folder and GET /scan/{id}, and consumes ExportRequest at
 * POST /export. The shared TargetProfile is the contract argus-lens inherits.
 */

export type TargetStyle = "photo" | "anime";
export type TargetCategory = "identity" | "wardrobe" | "pose_composition" | "setting";
export type FacePose = "frontal" | "three_quarter" | "profile";

export const FACE_POSES: FacePose[] = ["frontal", "three_quarter", "profile"];

export const POSE_LABELS: Record<FacePose, string> = {
  frontal: "Head-on",
  three_quarter: "3/4",
  profile: "Profile",
};

export interface TargetProfile {
  target_style: TargetStyle;
  target_backend: string | null;
  checkpoint: string | null;
  target_category: TargetCategory;
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
}

export interface FaceDetection {
  bbox: [number, number, number, number]; // [x, y, w, h]
  det_score: number;
  cluster_id: string | null;
  primary: boolean;
  yaw: number | null;
  pitch: number | null;
  pose: FacePose | null;
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
  phash: string;
  score_breakdown: Record<string, number>;
}

export interface FaceCluster {
  cluster_id: string;
  size: number;
  representative_rel_path: string;
  representative_bbox: [number, number, number, number] | null;
}

export interface ScanSummary {
  scan_id: string;
  folder: string;
  target_profile: TargetProfile;
  config: ScanConfig;
  faces_config: FaceConfig;
  total: number;
  passed: number;
  rejected: number;
  duplicates: number;
  similar_clusters: number;
  reject_reasons: Record<string, number>;
  face_clusters: FaceCluster[];
  results: ImageResult[];
  offset: number;
  limit: number | null;
  returned: number;
}

export interface ExportRequest {
  scan_id?: string | null;
  selection?: string[] | null;
  dest: string;
  mode: "copy" | "symlink" | "move";
  preserve_structure: boolean;
  min_score: number;
  include_rejected: boolean;
  keep_similar: boolean;
  max_keep?: number | null;
  face_clusters?: string[] | null;
  face_poses?: FacePose[] | null;
  write_manifest: boolean;
  caption_url?: string | null;
}

export interface ExportResult {
  manifest_path: string | null;
  copied: number;
  skipped: number;
  dest: string;
  mode: string;
  selected_rel_paths: string[];
  captioned: boolean;
}

export interface Detectors {
  torch: boolean;
  cuda: boolean;
  clip: boolean;
  insightface: boolean;
  onnxruntime: boolean;
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

/** The editable slice of TargetProfile + ScanConfig + FaceConfig the panel manages. */
export interface CuratorConfig {
  profile: TargetProfile;
  config: ScanConfig;
  faces: FaceConfig;
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
    },
  };
}

/** Build the POST /scan/folder request body from the editable config. */
export function buildScanBody(folder: string, cfg: CuratorConfig): Record<string, unknown> {
  return {
    folder,
    target_profile: cfg.profile,
    config: cfg.config,
    faces: cfg.faces,
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
  };
}

/** True when an image should be shown / is eligible under the current facets. */
export function matchesFilters(img: ImageResult, f: CuratorFilters): boolean {
  if (img.score < f.minScore) return false;
  if (f.passedOnly && !img.passed) return false;
  if (f.hideDuplicates && img.is_duplicate) return false;
  if (f.singleFaceOnly && img.face_count !== 1) return false;
  if (f.requireKnownFace && !img.primary_face_cluster) return false;
  if (f.faceClusters.length > 0) {
    if (!img.primary_face_cluster || !f.faceClusters.includes(img.primary_face_cluster)) return false;
  }
  if (f.poses.length > 0) {
    if (!img.primary_face_pose || !f.poses.includes(img.primary_face_pose)) return false;
  }
  return true;
}
