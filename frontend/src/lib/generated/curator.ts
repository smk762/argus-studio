// Generated from smk762/argus-curator@v0.15.0 schema/curator-wire.schema.json.
// Do not edit: change schema/pins.json and run `npm run wire:pull`.

export interface CuratorWire {
  CropBox?: CropBox;
  CropConfig?: CropConfig;
  EraxConfig?: EraxConfig;
  EraxDetection?: EraxDetection;
  EraxResult?: EraxResult;
  ExportRequest?: ExportRequest;
  ExportResult?: ExportResult;
  FaceAttributes?: FaceAttributes;
  FaceCluster?: FaceCluster;
  FaceConfig?: FaceConfig;
  FaceDetection?: FaceDetection;
  FaceLandmarks?: FaceLandmarks;
  FaceSourceFilter?: FaceSourceFilter;
  GarmentConfig?: GarmentConfig;
  GarmentDetection?: GarmentDetection;
  GuardConfig?: GuardConfig;
  GuardResult?: GuardResult;
  ImageResult?: ImageResult;
  ManifestFace?: ManifestFace;
  ManifestRow?: ManifestRow;
  NsfwConfig?: NsfwConfig;
  NsfwDetection?: NsfwDetection;
  NsfwResult?: NsfwResult;
  PersonDetection?: PersonDetection;
  PrefilterConfig?: PrefilterConfig;
  ScanConfig?: ScanConfig;
  ScanRequest?: ScanRequest;
  ScanSummary?: ScanSummary;
  SceneConfig?: SceneConfig;
  SceneLabel?: SceneLabel;
  SceneTags?: SceneTags;
  SelectRequest?: SelectRequest;
  SelectResult?: SelectResult;
  SelectRow?: SelectRow;
  SetAge?: SetAge;
  TargetProfile?: TargetProfile;
  WatermarkDetection?: WatermarkDetection;
}
/**
 * A crop in pixels of the image as displayed: after its EXIF orientation, ``right``/``bottom`` exclusive.
 *
 * Recorded beside a source as ``<image>.crop.json`` (``{"left": .., "top": ..,
 * "right": .., "bottom": ..}``) or passed inline in :class:`CropConfig`. A box
 * must lie inside the frame and be non-empty; one that does not makes the
 * image a ``crop:`` reject rather than letting it through uncropped.
 */
export interface CropBox {
  bottom: number;
  left: number;
  right: number;
  top: number;
}
/**
 * Opt-in crops (watermarks, borders) applied to the bytes in memory, never to the source.
 *
 * With ``enabled``, an image with a box is cropped once after it is read, and
 * every check (scoring, faces, NudeNet, SingGuard ...) sees the cropped frame;
 * face boxes and sizes are in its pixels. Export writes the cropped image, so
 * a cropped scan exports only by ``mode="copy"``.
 *
 * A box is given by hand (``boxes``, keyed by rel_path, wins over a
 * ``<image>.crop.json`` sidecar; ``sidecars`` False reads none) or, with
 * ``detect``, found: every image without a box by hand goes to the watermark
 * detector (``ARGUS_CURATOR_WATERMARK_URL``), and the hits of at least
 * ``min_conf`` are cut away along the frame's edges. Each edge may lose at
 * most ``max_cut`` of the frame's side; ``margin`` (pixels) is cut beyond a
 * hit's edge. A hit that no such cut removes is an overlay: with
 * ``reject_overlay`` the image is a ``crop:overlay`` reject, else it is kept
 * uncropped with its hits recorded. An image the detector could not check is
 * a ``crop:unchecked`` reject. An image with no box is scanned as it is.
 */
export interface CropConfig {
  boxes?: {
    [k: string]: CropBox;
  };
  detect?: boolean;
  enabled?: boolean;
  margin?: number;
  max_cut?: number;
  min_conf?: number;
  reject_overlay?: boolean;
  sidecars?: boolean;
}
/**
 * Optional EraX-NSFW fill-in via a remote server (see erax.py).
 *
 * The URL (ARGUS_CURATOR_ERAX_URL) is process configuration, like NudeNet.
 * A finished scan records whether the check ran as True or False.
 */
export interface EraxConfig {
  enabled: boolean | null;
}
/**
 * One EraX-NSFW detection. ``bbox`` is ``[x, y, w, h]`` in source pixels.
 */
export interface EraxDetection {
  /**
   * [x, y, w, h]
   *
   * @minItems 4
   * @maxItems 4
   */
  bbox: [number, number, number, number];
  label: "anus" | "make_love" | "nipple" | "penis" | "vagina";
  score: number;
}
/**
 * EraX-NSFW's view of one image. Classes are EraX's own, not NudeNet's.
 */
export interface EraxResult {
  detections: EraxDetection[];
  labels: {
    [k: string]: number;
  };
}
export interface ExportRequest {
  caption_url?: string | null;
  carry_sidecars?: boolean;
  content_ratings?: ["safe" | "suggestive" | "explicit", ...("safe" | "suggestive" | "explicit")[]] | null;
  dest: string;
  diversify_outfits?: boolean;
  diversify_scenes?: boolean;
  exclude_garments?:
    | (
        | "shirt_blouse"
        | "top_tshirt_sweatshirt"
        | "sweater"
        | "cardigan"
        | "jacket"
        | "vest"
        | "pants"
        | "shorts"
        | "skirt"
        | "coat"
        | "dress"
        | "jumpsuit"
        | "cape"
        | "glasses"
        | "hat"
        | "headband_hair_accessory"
        | "tie"
        | "glove"
        | "watch"
        | "belt"
        | "leg_warmer"
        | "tights_stockings"
        | "sock"
        | "shoe"
        | "bag_wallet"
        | "scarf"
        | "umbrella"
      )[]
    | null;
  face_ages?: ("0-2" | "3-9" | "10-19" | "20-29" | "30-39" | "40-49" | "50-59" | "60-69" | "70+")[] | null;
  face_clusters?: string[] | null;
  face_genders?: ("male" | "female")[] | null;
  face_names?: {
    [k: string]: string;
  } | null;
  face_poses?: ("frontal" | "three_quarter" | "profile")[] | null;
  face_races?:
    ("white" | "black" | "latino_hispanic" | "east_asian" | "southeast_asian" | "indian" | "middle_eastern")[] | null;
  face_source?: FaceSourceFilter | null;
  garments?:
    | (
        | "shirt_blouse"
        | "top_tshirt_sweatshirt"
        | "sweater"
        | "cardigan"
        | "jacket"
        | "vest"
        | "pants"
        | "shorts"
        | "skirt"
        | "coat"
        | "dress"
        | "jumpsuit"
        | "cape"
        | "glasses"
        | "hat"
        | "headband_hair_accessory"
        | "tie"
        | "glove"
        | "watch"
        | "belt"
        | "leg_warmer"
        | "tights_stockings"
        | "sock"
        | "shoe"
        | "bag_wallet"
        | "scarf"
        | "umbrella"
      )[]
    | null;
  garments_uncropped?: boolean;
  guard_policies?:
    | [
        "default" | "adult" | "adult-granular" | "adult-cautious" | "adult-cinematic",
        ...("default" | "adult" | "adult-granular" | "adult-cautious" | "adult-cinematic")[]
      ]
    | null;
  guard_rules?: string[] | null;
  guard_unsafe?: boolean;
  /**
   * Ignored: a rejected image is never kept. Accepted so older clients still validate.
   */
  include_rejected?: boolean;
  keep_similar?: boolean;
  landmarks?: boolean;
  max_age_years?: number | null;
  max_keep?: number | null;
  min_age_years?: number | null;
  min_attribute_conf?: number;
  min_garment_conf?: number;
  min_scene_conf?: number;
  min_score?: number;
  mode?: "copy" | "symlink" | "move";
  /**
   * @minItems 1
   */
  nsfw_exposed_labels?: [
    (
      | "FEMALE_GENITALIA_COVERED"
      | "FACE_FEMALE"
      | "BUTTOCKS_EXPOSED"
      | "FEMALE_BREAST_EXPOSED"
      | "FEMALE_GENITALIA_EXPOSED"
      | "MALE_BREAST_EXPOSED"
      | "ANUS_EXPOSED"
      | "FEET_EXPOSED"
      | "BELLY_COVERED"
      | "FEET_COVERED"
      | "ARMPITS_COVERED"
      | "ARMPITS_EXPOSED"
      | "FACE_MALE"
      | "BELLY_EXPOSED"
      | "MALE_GENITALIA_EXPOSED"
      | "ANUS_COVERED"
      | "FEMALE_BREAST_COVERED"
      | "BUTTOCKS_COVERED"
    ),
    ...(
      | "FEMALE_GENITALIA_COVERED"
      | "FACE_FEMALE"
      | "BUTTOCKS_EXPOSED"
      | "FEMALE_BREAST_EXPOSED"
      | "FEMALE_GENITALIA_EXPOSED"
      | "MALE_BREAST_EXPOSED"
      | "ANUS_EXPOSED"
      | "FEET_EXPOSED"
      | "BELLY_COVERED"
      | "FEET_COVERED"
      | "ARMPITS_COVERED"
      | "ARMPITS_EXPOSED"
      | "FACE_MALE"
      | "BELLY_EXPOSED"
      | "MALE_GENITALIA_EXPOSED"
      | "ANUS_COVERED"
      | "FEMALE_BREAST_COVERED"
      | "BUTTOCKS_COVERED"
    )[]
  ];
  nsfw_label_thresholds?: {
    [k: string]: number;
  } | null;
  nsfw_threshold?: number | null;
  preserve_structure?: boolean;
  run_stats?: {
    [k: string]: unknown;
  } | null;
  scan_id?: string | null;
  scene_environments?: ("indoor" | "outdoor")[] | null;
  scenes?: string[] | null;
  selection?: string[] | null;
  write_manifest?: boolean;
  write_xmp?: boolean;
}
/**
 * The face-source preset: images a head can be built from (argus-mask).
 *
 * Every check reads the primary face; ``None`` turns a check off. The
 * defaults are the preset, so ``{}`` asks for all of it: one identity, one
 * face, frontal and level, large and sharp, eyes open, mouth closed, close
 * to the identity, and an adult age. An image that fails is kept out with
 * ``face-source:<check>`` as its keep reason, and the kept images are ranked
 * best first.
 */
export interface FaceSourceFilter {
  cluster?: string | null;
  max_identity_distance?: number | null;
  max_mouth_open?: number | null;
  max_pitch?: number | null;
  max_roll?: number | null;
  max_yaw?: number | null;
  min_eye_open?: number | null;
  min_face_px?: number | null;
  min_face_sharpness?: number | null;
  require_adult?: boolean;
  single_face?: boolean;
}
export interface ExportResult {
  captioned: boolean;
  copied: number;
  cropped: number;
  dest: string;
  exported_abs_paths: {
    [k: string]: string;
  };
  exported_paths: {
    [k: string]: string;
  };
  manifest_path: string | null;
  manifest_version: string;
  mode: "copy" | "symlink" | "move";
  run_stats_path: string | null;
  selected_rel_paths: string[];
  sidecars_carried: number;
  sidecars_failed: number;
  skipped: number;
  xmp_written: number;
}
/**
 * Predicted attributes of one face (or a cluster's pooled prediction).
 *
 * Each ``*_conf`` is the softmax probability of the chosen label, so a low
 * value means the model was torn between labels. ``race`` comes only from
 * FairFace. Gender and age come from MiVOLO when it ran, else FairFace (see
 * ``*_source``); a MiVOLO age is a regression, so ``age_years`` is set,
 * ``age`` is its derived bracket, and ``age_conf`` is ``None``.
 */
export interface FaceAttributes {
  age: ("0-2" | "3-9" | "10-19" | "20-29" | "30-39" | "40-49" | "50-59" | "60-69" | "70+") | null;
  age_body: boolean | null;
  age_conf: number | null;
  age_source: ("fairface" | "mivolo") | null;
  age_years: number | null;
  gender: ("male" | "female") | null;
  gender_conf: number | null;
  gender_source: ("fairface" | "mivolo") | null;
  race: ("white" | "black" | "latino_hispanic" | "east_asian" | "southeast_asian" | "indian" | "middle_eastern") | null;
  race_conf: number | null;
}
/**
 * A clustered identity across the scanned dataset.
 */
export interface FaceCluster {
  attributes: FaceAttributes | null;
  cluster_id: string;
  /**
   * [x, y, w, h]
   */
  representative_bbox: [number, number, number, number] | null;
  representative_rel_path: string;
  size: number;
}
/**
 * InsightFace detection + identity-clustering configuration (M2).
 */
export interface FaceConfig {
  body_face_match?: number;
  body_min_score?: number;
  body_min_size?: number;
  body_min_visible?: number;
  body_model?: string;
  cluster_eps?: number;
  device?: string;
  enabled?: boolean;
  fairface?: boolean;
  frontal_max_yaw?: number;
  min_det_score?: number;
  mivolo?: boolean;
  mivolo_body?: boolean;
  model?: string;
  profile_min_yaw?: number;
  reference_paths?: string[];
  set_age?: boolean;
  set_age_min_faces?: number;
  set_age_min_share?: number;
}
/**
 * One detected face within an image.
 */
export interface FaceDetection {
  attributes: FaceAttributes | null;
  /**
   * [x, y, w, h]
   *
   * @minItems 4
   * @maxItems 4
   */
  bbox: [number, number, number, number];
  cluster_distance: number | null;
  cluster_id: string | null;
  det_score: number;
  exposed_score: number;
  eye_open: number | null;
  mouth_open: number | null;
  nsfw_labels: {
    [k: string]: number;
  };
  person_index: number | null;
  pitch: number | null;
  pose: ("frontal" | "three_quarter" | "profile") | null;
  primary: boolean;
  reference_distance: number | null;
  roll: number | null;
  sharpness: number | null;
  yaw: number | null;
}
/**
 * InsightFace's landmarks for one face, in the image's pixels.
 *
 * ``kps`` are the detector's 5 keypoints (eyes, nose tip, mouth corners) as
 * ``[x, y]``; ``landmark_3d_68`` the 68 iBUG points as ``[x, y, z]``. Kept in
 * the scan cache only, and written to a manifest when an export asks
 * (``ExportRequest.landmarks``): they are the largest per-face payload.
 */
export interface FaceLandmarks {
  kps: number[][] | null;
  landmark_3d_68: number[][] | null;
}
/**
 * Fashionpedia garment detection on whole images (see garments.py).
 *
 * The model file is process configuration (ARGUS_CURATOR_GARMENTS_MODEL),
 * deliberately not a field here.
 */
export interface GarmentConfig {
  device?: string;
  enabled?: boolean;
  min_conf?: number;
}
/**
 * One detected garment.
 */
export interface GarmentDetection {
  /**
   * [x, y, w, h]
   *
   * @minItems 4
   * @maxItems 4
   */
  bbox: [number, number, number, number];
  color: string;
  conf: number;
  label:
    | "shirt_blouse"
    | "top_tshirt_sweatshirt"
    | "sweater"
    | "cardigan"
    | "jacket"
    | "vest"
    | "pants"
    | "shorts"
    | "skirt"
    | "coat"
    | "dress"
    | "jumpsuit"
    | "cape"
    | "glasses"
    | "hat"
    | "headband_hair_accessory"
    | "tie"
    | "glove"
    | "watch"
    | "belt"
    | "leg_warmer"
    | "tights_stockings"
    | "sock"
    | "shoe"
    | "bag_wallet"
    | "scarf"
    | "umbrella";
  touches_edge: boolean;
}
/**
 * SingGuard policy check via a remote SingGuard server (see guard.py).
 *
 * Like NudeNet, the URL (ARGUS_CURATOR_SINGGUARD_URL) is process
 * configuration. A request picks a policy by name, never by text.
 */
export interface GuardConfig {
  enabled?: boolean | null;
  policy?: "default" | "adult" | "adult-granular" | "adult-cautious" | "adult-cinematic";
  variants?: ("default" | "adult" | "adult-granular" | "adult-cautious" | "adult-cinematic")[];
}
/**
 * SingGuard's verdict on one image. A verdict, not a score: SingGuard
 * reports which policy rules fired, not how confident it is.
 */
export interface GuardResult {
  explanation?: string | null;
  model?: string | null;
  policy?: string;
  rules?: string[];
  safe: boolean;
  thinking?: string | null;
}
/**
 * Per-image curation record — superset of imogen's scanner output.
 *
 * ``rel_path`` is the path relative to the scanned root and is the stable key
 * everywhere (it stays unique across sub-folders, unlike a bare basename).
 */
export interface ImageResult {
  abs_path: string;
  artifact_score: number;
  /**
   * Derived from :attr:`nsfw` on read, so a scan cached before ratings existed has one too.
   */
  content_rating: ("safe" | "suggestive" | "explicit") | null;
  crop: CropBox | null;
  crop_source: ("manual" | "detected") | null;
  duplicate_of: string | null;
  erax: EraxResult | null;
  erax_filled: boolean;
  face_count: number;
  face_error: string | null;
  faces: FaceDetection[];
  garments: GarmentDetection[] | null;
  group_size: number;
  guard: GuardResult | null;
  guard_variants: {
    [k: string]: GuardResult;
  } | null;
  height: number;
  is_duplicate: boolean;
  is_representative: boolean;
  keep_reason: string;
  nsfw: NsfwResult | null;
  nudenet_failed: boolean;
  passed: boolean;
  people: PersonDetection[];
  people_check: ("ok" | "detection_failed" | "body_ages_failed") | null;
  people_error: string | null;
  phash: string;
  primary_face_attributes: FaceAttributes | null;
  primary_face_cluster: string | null;
  primary_face_pitch: number | null;
  primary_face_pose: ("frontal" | "three_quarter" | "profile") | null;
  primary_face_roll: number | null;
  primary_face_yaw: number | null;
  reject_reason: string | null;
  rel_path: string;
  scene: SceneTags | null;
  score: number;
  score_breakdown: {
    [k: string]: number;
  };
  set_age: SetAge | null;
  sharpness: number;
  similar_group: number;
  watermarks: WatermarkDetection[] | null;
  width: number;
}
/**
 * NudeNet's view of one image.
 *
 * Only detections scoring >= :data:`MIN_REPORTED_SCORE` are kept, so a class
 * missing from ``labels`` scored below that. ``exposed_score`` is the highest score among
 * :data:`DEFAULT_EXPOSED_LABELS`; filters can recompute it over another set.
 */
export interface NsfwResult {
  detections?: NsfwDetection[];
  exposed_score?: number;
  labels?: {
    [k: string]: number;
  };
}
/**
 * One NudeNet detection.
 */
export interface NsfwDetection {
  /**
   * [x, y, w, h]
   *
   * @minItems 4
   * @maxItems 4
   */
  bbox: [number, number, number, number];
  label:
    | "FEMALE_GENITALIA_COVERED"
    | "FACE_FEMALE"
    | "BUTTOCKS_EXPOSED"
    | "FEMALE_BREAST_EXPOSED"
    | "FEMALE_GENITALIA_EXPOSED"
    | "MALE_BREAST_EXPOSED"
    | "ANUS_EXPOSED"
    | "FEET_EXPOSED"
    | "BELLY_COVERED"
    | "FEET_COVERED"
    | "ARMPITS_COVERED"
    | "ARMPITS_EXPOSED"
    | "FACE_MALE"
    | "BELLY_EXPOSED"
    | "MALE_GENITALIA_EXPOSED"
    | "ANUS_COVERED"
    | "FEMALE_BREAST_COVERED"
    | "BUTTOCKS_COVERED";
  score: number;
}
/**
 * One person box from InsightFace's Cheetah detector (FaceConfig.mivolo_body).
 *
 * ``face_index`` is the face it was given, or ``None`` when no face matched
 * (a body-only crop; MiVOLO then runs with an absent face). ``nsfw_labels``
 * are NudeNet detections whose box overlaps this person.
 */
export interface PersonDetection {
  age_body: boolean | null;
  age_source: ("fairface" | "mivolo") | null;
  age_years: number | null;
  /**
   * [x, y, w, h]
   *
   * @minItems 4
   * @maxItems 4
   */
  bbox: [number, number, number, number];
  det_score: number;
  exposed_score: number;
  face_index: number | null;
  nsfw_labels: {
    [k: string]: number;
  };
}
/**
 * Places365 prediction for one image.
 *
 * ``categories`` are the top-k scene labels, most probable first, each with
 * its softmax probability. ``environment_conf`` is the probability mass on
 * categories of the chosen environment, so it is always at least 0.5.
 */
export interface SceneTags {
  categories: SceneLabel[];
  environment: "indoor" | "outdoor";
  environment_conf: number;
}
export interface SceneLabel {
  conf: number;
  label: string;
}
/**
 * An age for a frame with no face, read off the set the frame belongs to.
 *
 * ``years`` is the median MiVOLO age of the faces in the scan's dominant
 * identity, ``cluster_id`` that identity, ``faces`` how many ages it is read
 * from, and ``share`` the fraction of the scan's faces in it. It is an
 * inference about the set, not a reading of this frame: a viewer shows it as
 * such, and treats it as it treats a measured age where a wrong age would be
 * the costlier mistake.
 */
export interface SetAge {
  cluster_id: string;
  faces: number;
  share: number;
  years: number;
}
/**
 * One watermark the detector found: ``[x, y, w, h]`` in displayed pixels of the uncropped frame.
 */
export interface WatermarkDetection {
  /**
   * [x, y, w, h]
   *
   * @minItems 4
   * @maxItems 4
   */
  bbox: [number, number, number, number];
  label: string;
  score: number;
}
/**
 * The primary face of a manifest row (manifest 2.3).
 */
export interface ManifestFace {
  age_years: number | null;
  /**
   * [x, y, w, h]
   *
   * @minItems 4
   * @maxItems 4
   */
  bbox: [number, number, number, number];
  cluster_distance: number | null;
  eye_open: number | null;
  landmarks: FaceLandmarks | null;
  mouth_open: number | null;
  pitch: number | null;
  reference_distance: number | null;
  roll: number | null;
  sharpness: number | null;
  yaw: number | null;
}
/**
 * One line of the JSONL handoff manifest (written by ``export.write_manifest``).
 *
 * ``exported_path`` is the path actually written under the export root
 * (posix, relative to it). Consumers must use it instead of re-deriving a
 * destination from ``rel_path`` — flattened exports de-collide basenames, and
 * with carried sidecars a root image cannot take the stem of an export file,
 * so the two can differ. Rows exist only for files whose transfer succeeded.
 *
 * ``exported_abs_path`` is that same file's absolute location, so a row is
 * self-contained: the manifest is often read somewhere other than the export
 * root it was written into (argus-lens receives it as an upload), and nothing
 * in the row names the root to join ``exported_path`` onto.
 *
 * ``abs_path`` is where the image can be *read*, which is not always where it
 * came from: ``mode="move"`` deletes the source during transfer, so for a
 * moved export it equals ``exported_abs_path``. Use ``rel_path`` for the
 * original location within the scan.
 */
export interface ManifestRow {
  abs_path: string;
  crop: CropBox | null;
  exported_abs_path: string;
  exported_path: string;
  manifest_version: string;
  primary_face: ManifestFace | null;
  primary_face_cluster: string | null;
  primary_face_pose: ("frontal" | "three_quarter" | "profile") | null;
  rel_path: string;
  score: number;
  set_age: SetAge | null;
  similar_group: number;
  target_profile: TargetProfile;
}
/**
 * What we are curating *for* — shared verbatim with argus-lens.
 *
 * The curator uses it to weight scoring and label exports; the captioner
 * inherits it to pick caption variants. This is the reason generic CV tools
 * (FiftyOne / fastdup) structurally cannot replace the suite.
 */
export interface TargetProfile {
  checkpoint?: string | null;
  target_backend?: string | null;
  target_category?: "identity" | "wardrobe" | "pose_composition" | "setting" | "concept";
  target_style?: "photo" | "anime";
}
/**
 * NudeNet nudity detection via a remote NudeNet server (see nsfw.py).
 *
 * The server URL is process configuration (ARGUS_CURATOR_NUDENET_URL),
 * deliberately not a field here: a request-supplied URL would let any API
 * caller make this server send images to an address of their choosing.
 */
export interface NsfwConfig {
  enabled?: boolean | null;
}
/**
 * Opt-in drops applied before the late scan phases (see prefilter.py).
 *
 * Right after the identities phase, a passing image that matches a rule is
 * turned into a reject (``passed`` False, ``reject_reason``
 * ``prefilter:nsfw`` / ``prefilter:no-face`` / ``prefilter:no-age``, the
 * first that applies in that order). It stays in the results, but scenes,
 * garments and SingGuard never run on it. Hard rejects keep their own reason.
 *
 * ``drop_nsfw``: an exposed NudeNet reading of at least 0.2 (an image NudeNet
 * and EraX could not score is kept; needs the NudeNet check). ``drop_no_face``:
 * no face detected (needs face detection; an image whose detection failed,
 * ``face_error``, is kept). ``drop_no_age``: no MiVOLO age on any face, no
 * body-only age, and no set age (needs MiVOLO; a failed detection has no age,
 * so it is dropped).
 */
export interface PrefilterConfig {
  drop_no_age?: boolean;
  drop_no_face?: boolean;
  drop_nsfw?: boolean;
}
/**
 * Tunable parameters for a training-suitability scan.
 */
export interface ScanConfig {
  blur_threshold?: number;
  cluster_distance?: number;
  diversity_weight?: number;
  max_aspect_ratio?: number;
  max_workers?: number;
  min_short_side?: number;
  resolution_ref?: number;
  sharpness_ref?: number;
  weight_artifact?: number;
  weight_resolution?: number;
  weight_sharpness?: number;
  weight_subject?: number;
}
export interface ScanRequest {
  config?: ScanConfig;
  crops?: CropConfig;
  faces?: FaceConfig;
  folder: string;
  garments?: GarmentConfig;
  guard?: GuardConfig;
  nsfw?: NsfwConfig;
  prefilter?: PrefilterConfig;
  scenes?: SceneConfig;
  target_profile?: TargetProfile;
}
/**
 * Places365 scene tagging of whole images (see scenes.py).
 *
 * The model file is process configuration (ARGUS_CURATOR_PLACES365_MODEL),
 * deliberately not a field here.
 */
export interface SceneConfig {
  device?: string;
  enabled?: boolean;
  top_k?: number;
}
/**
 * Full result of a scan — persisted on disk and paginated by the server.
 */
export interface ScanSummary {
  config: ScanConfig;
  crop_config: CropConfig;
  duplicates: number;
  erax_config: EraxConfig;
  face_clusters: FaceCluster[];
  faces_config: FaceConfig;
  folder: string;
  garments_config: GarmentConfig;
  guard_config: GuardConfig;
  limit: number | null;
  nsfw_config: NsfwConfig;
  offset: number;
  passed: number;
  prefilter_config: PrefilterConfig;
  reference_skipped: string | null;
  reject_reasons: {
    [k: string]: number;
  };
  rejected: number;
  results: ImageResult[];
  returned: number;
  scan_id: string;
  scenes_config: SceneConfig;
  set_age: SetAge | null;
  set_age_skipped: string | null;
  similar_clusters: number;
  target_profile: TargetProfile;
  total: number;
}
/**
 * Filter body for ``POST /scan/{id}/select``.
 *
 * The filter fields of :class:`ExportRequest`, and none of the transfer
 * fields (``dest``, ``mode``, ``selection``). ``max_keep`` and the diversify
 * flags are absent on purpose: this route never diversity-trims.
 */
export interface SelectRequest {
  content_ratings?: ["safe" | "suggestive" | "explicit", ...("safe" | "suggestive" | "explicit")[]] | null;
  exclude_garments?:
    | (
        | "shirt_blouse"
        | "top_tshirt_sweatshirt"
        | "sweater"
        | "cardigan"
        | "jacket"
        | "vest"
        | "pants"
        | "shorts"
        | "skirt"
        | "coat"
        | "dress"
        | "jumpsuit"
        | "cape"
        | "glasses"
        | "hat"
        | "headband_hair_accessory"
        | "tie"
        | "glove"
        | "watch"
        | "belt"
        | "leg_warmer"
        | "tights_stockings"
        | "sock"
        | "shoe"
        | "bag_wallet"
        | "scarf"
        | "umbrella"
      )[]
    | null;
  face_ages?: ("0-2" | "3-9" | "10-19" | "20-29" | "30-39" | "40-49" | "50-59" | "60-69" | "70+")[] | null;
  face_clusters?: string[] | null;
  face_genders?: ("male" | "female")[] | null;
  face_poses?: ("frontal" | "three_quarter" | "profile")[] | null;
  face_races?:
    ("white" | "black" | "latino_hispanic" | "east_asian" | "southeast_asian" | "indian" | "middle_eastern")[] | null;
  face_source?: FaceSourceFilter | null;
  garments?:
    | (
        | "shirt_blouse"
        | "top_tshirt_sweatshirt"
        | "sweater"
        | "cardigan"
        | "jacket"
        | "vest"
        | "pants"
        | "shorts"
        | "skirt"
        | "coat"
        | "dress"
        | "jumpsuit"
        | "cape"
        | "glasses"
        | "hat"
        | "headband_hair_accessory"
        | "tie"
        | "glove"
        | "watch"
        | "belt"
        | "leg_warmer"
        | "tights_stockings"
        | "sock"
        | "shoe"
        | "bag_wallet"
        | "scarf"
        | "umbrella"
      )[]
    | null;
  garments_uncropped?: boolean;
  guard_policies?:
    | [
        "default" | "adult" | "adult-granular" | "adult-cautious" | "adult-cinematic",
        ...("default" | "adult" | "adult-granular" | "adult-cautious" | "adult-cinematic")[]
      ]
    | null;
  guard_rules?: string[] | null;
  guard_unsafe?: boolean;
  /**
   * Ignored: a rejected image is never kept. Accepted so older clients still validate.
   */
  include_rejected?: boolean;
  keep_similar?: boolean;
  max_age_years?: number | null;
  min_age_years?: number | null;
  min_attribute_conf?: number;
  min_garment_conf?: number;
  min_scene_conf?: number;
  min_score?: number;
  /**
   * @minItems 1
   */
  nsfw_exposed_labels?: [
    (
      | "FEMALE_GENITALIA_COVERED"
      | "FACE_FEMALE"
      | "BUTTOCKS_EXPOSED"
      | "FEMALE_BREAST_EXPOSED"
      | "FEMALE_GENITALIA_EXPOSED"
      | "MALE_BREAST_EXPOSED"
      | "ANUS_EXPOSED"
      | "FEET_EXPOSED"
      | "BELLY_COVERED"
      | "FEET_COVERED"
      | "ARMPITS_COVERED"
      | "ARMPITS_EXPOSED"
      | "FACE_MALE"
      | "BELLY_EXPOSED"
      | "MALE_GENITALIA_EXPOSED"
      | "ANUS_COVERED"
      | "FEMALE_BREAST_COVERED"
      | "BUTTOCKS_COVERED"
    ),
    ...(
      | "FEMALE_GENITALIA_COVERED"
      | "FACE_FEMALE"
      | "BUTTOCKS_EXPOSED"
      | "FEMALE_BREAST_EXPOSED"
      | "FEMALE_GENITALIA_EXPOSED"
      | "MALE_BREAST_EXPOSED"
      | "ANUS_EXPOSED"
      | "FEET_EXPOSED"
      | "BELLY_COVERED"
      | "FEET_COVERED"
      | "ARMPITS_COVERED"
      | "ARMPITS_EXPOSED"
      | "FACE_MALE"
      | "BELLY_EXPOSED"
      | "MALE_GENITALIA_EXPOSED"
      | "ANUS_COVERED"
      | "FEMALE_BREAST_COVERED"
      | "BUTTOCKS_COVERED"
    )[]
  ];
  nsfw_label_thresholds?: {
    [k: string]: number;
  } | null;
  nsfw_threshold?: number | null;
  scene_environments?: ("indoor" | "outdoor")[] | null;
  scenes?: string[] | null;
}
/**
 * What the current filter would keep, without writing the export root.
 */
export interface SelectResult {
  kept: number;
  rows: SelectRow[];
  scan_id: string;
  total: number;
}
/**
 * One image under a dry-run selection.
 *
 * ``keep_reason`` is empty when the image is in the selection. A non-empty
 * value is why ``decide_selection`` left it out — the same strings an export
 * report would write, without copying anything.
 */
export interface SelectRow {
  abs_path: string;
  keep_reason: string;
  rel_path: string;
}
