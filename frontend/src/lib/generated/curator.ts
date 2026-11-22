// Generated from smk762/argus-curator@1d04173 (0.20.0) schema/curator-wire.schema.json.
// Do not edit: change schema/pins.json and run `npm run wire:pull`.

export interface CuratorWire {
  BodyPoseLabels?: BodyPoseLabels;
  ClipResult?: ClipResult;
  ConsentBinding?: ConsentBinding;
  ConsentCheck?: ConsentCheck;
  ConsentConfig?: ConsentConfig;
  CropBox?: CropBox;
  CropConfig?: CropConfig;
  EmbeddingConfig?: EmbeddingConfig;
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
  Generator?: Generator;
  GuardConfig?: GuardConfig;
  GuardResult?: GuardResult;
  ImageResult?: ImageResult;
  ManifestFace?: ManifestFace;
  ManifestRow?: ManifestRow;
  NsfwConfig?: NsfwConfig;
  NsfwDetection?: NsfwDetection;
  NsfwResult?: NsfwResult;
  PersonDetection?: PersonDetection;
  PoseCluster?: PoseCluster;
  PoseConfig?: PoseConfig;
  PoseSummary?: PoseSummary;
  PrefilterConfig?: PrefilterConfig;
  Provenance?: Provenance;
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
  SpeakerCluster?: SpeakerCluster;
  SpeechConfig?: SpeechConfig;
  SpeechManifestRow?: SpeechManifestRow;
  SpeechMos?: SpeechMos;
  SpeechSelectStats?: SpeechSelectStats;
  SpeechSelection?: SpeechSelection;
  SpeechTargetProfile?: SpeechTargetProfile;
  SplitConfig?: SplitConfig;
  TargetProfile?: TargetProfile;
  WatermarkDetection?: WatermarkDetection;
  ZeroShotResult?: ZeroShotResult;
}
/**
 * The primary person's body-pose labels, as argus-puppet derived them. Keypoints are never stored.
 */
export interface BodyPoseLabels {
  arms: "up" | "out" | "down" | "mixed" | "unknown";
  facing: "front" | "back" | "left" | "right" | "unknown";
  stance: "standing" | "jumping" | "crouching" | "seated" | "lying" | "unknown";
}
/**
 * Per-clip record of a speech scan, keyed by ``rel_path`` like :class:`ImageResult`.
 *
 * A measurement is ``None`` when the scan never got to it (the clip could not
 * be decoded, or the check was not asked for). The corpus labels
 * (``speaker``, ``accent``, ``language``, ``age``) are copied verbatim from
 * the corpus metadata, never estimated.
 */
export interface ClipResult {
  abs_path: string;
  accent: string | null;
  age: string | null;
  cer: number | null;
  channels: number | null;
  chars_per_s: number | null;
  clipping_ratio: number | null;
  duplicate_of: string | null;
  duration_s: number | null;
  failed_checks: (
    | "unreadable"
    | "corpus_under_18"
    | "duration"
    | "sample_rate"
    | "channels"
    | "silent"
    | "clipping"
    | "leading_silence"
    | "trailing_silence"
    | "transcript"
    | "speaking_rate"
    | "snr"
    | "speech_ratio"
    | "mos"
    | "cer"
    | "language"
  )[];
  fingerprint: string;
  gender: string | null;
  group_size: number;
  is_duplicate: boolean;
  is_representative: boolean;
  language: string | null;
  language_confidence: number | null;
  language_error: string | null;
  language_label_confidence: number | null;
  language_mismatch: boolean;
  language_predicted: string | null;
  leading_silence_s: number | null;
  mos: SpeechMos | null;
  mos_error: string | null;
  passed: boolean;
  reject_detail: string | null;
  reject_reason:
    | (
        | "unreadable"
        | "corpus_under_18"
        | "duration"
        | "sample_rate"
        | "channels"
        | "silent"
        | "clipping"
        | "leading_silence"
        | "trailing_silence"
        | "transcript"
        | "speaking_rate"
        | "snr"
        | "speech_ratio"
        | "mos"
        | "cer"
        | "language"
      )
    | null;
  rel_path: string;
  sample_rate: number | null;
  score: number;
  score_breakdown: {
    [k: string]: number;
  };
  similar_group: number;
  snr_db: number | null;
  speaker: string | null;
  speaker_cluster: string | null;
  speaker_distance: number | null;
  speaker_error: string | null;
  speaker_mismatch: boolean;
  speech_ratio: number | null;
  stt_transcript: string | null;
  trailing_silence_s: number | null;
  transcript: string | null;
  transcript_source: ("sidecar" | "ljspeech" | "common_voice") | null;
  vad: ("energy" | "silero") | null;
  vad_error: string | null;
}
/**
 * DNSMOS P.835 predictions for a clip, each 1-5: speech (SIG), background (BAK), overall (OVRL).
 */
export interface SpeechMos {
  bak: number;
  model: "dnsmos";
  ovrl: number;
  sig: number;
}
/**
 * Whether one image is bound to the scan's consent record (ImageResult.consent).
 */
export interface ConsentBinding {
  bound: boolean;
  distance: number | null;
  reason: ("not-consented" | "provenance" | "unchecked" | "no-face" | "bystander" | "mismatch") | null;
}
/**
 * What the scan made of its consent record (ScanSummary.consent).
 *
 * Never the record: a record names a person, so the scan keeps only the
 * verdict, the record's hashes and which images are the references. It is
 * part of the scan, so deleting or purging the scan removes it.
 */
export interface ConsentCheck {
  checked_at: string;
  detail: string;
  eligible: boolean;
  max_distance: number;
  missing_references: number;
  reason:
    | ("missing" | "invalid" | "no-reference-image" | "no-reference-face")
    | ("revoked" | "not-yet-signed" | "expired" | "likeness-not-covered" | "use-not-covered" | "delivery-not-covered")
    | null;
  record: string;
  record_sha256: string | null;
  references: string[];
  release_sha256: string | null;
}
/**
 * Bind a real person's face set to their consent record (#133; see consent.py).
 *
 * ``record`` is the :class:`argus_cortex.consent.ConsentRecord` file, a path
 * relative to the scanned folder (the server refuses one that resolves
 * outside it). None = no consent check. With a record the scan reads it,
 * checks it for the ``avatar`` use of the subject's face, builds the identity
 * reference from the record's reference images (found in the scan by their
 * sha256), and binds each image: its primary face within ``max_distance`` of
 * that reference, and no one else in the frame. Turning it on turns on face
 * detection, MiVOLO and the set age, which the export gate needs.
 */
export interface ConsentConfig {
  max_distance?: number;
  record?: string | null;
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
 * Semantic image embeddings of whole images, a CLIP image tower (see embeddings.py).
 *
 * The vectors are held in memory for the scan only, never written, and are
 * gone once the scan is deleted or the server restarts. The model (and so the
 * embedding space) is process configuration (ARGUS_CURATOR_EMBEDDINGS_MODEL,
 * ``embeddings.EMBEDDING_SPACE``), deliberately not a field here.
 */
export interface EmbeddingConfig {
  device?: string;
  enabled?: boolean;
  reference_embedding?: [number, ...number[]] | null;
  reference_paths?: string[];
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
  diversify_semantic?: boolean;
  diversity_weight?: number | null;
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
  exclude_references?: boolean;
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
  max_likeness_distance?: number | null;
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
  rank?: "score" | "identity" | "likeness";
  run_stats?: {
    [k: string]: unknown;
  } | null;
  scan_id?: string | null;
  scene_environments?: ("indoor" | "outdoor")[] | null;
  scenes?: string[] | null;
  selection?: string[] | null;
  speech?: SpeechSelection | null;
  split?: SplitConfig | null;
  split_part?: "train" | "held_out";
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
  consent?: boolean;
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
/**
 * How a speech scan's clips are selected, and where they came from (#187).
 *
 * The speech part of :class:`ExportRequest` and :class:`SelectRequest`, and
 * the only part a speech scan reads besides ``min_score``, ``keep_similar``,
 * ``max_keep``, ``split`` and the transfer fields; the image filters are
 * refused on a speech scan.
 *
 * Filters: ``speakers`` (by ``speaker_id``), ``accents`` and ``languages``
 * (the corpus labels, exact). ``exclude_speaker_mismatch`` drops clips whose
 * corpus speaker label the clustering disputes, and
 * ``exclude_language_mismatch`` those whose language label the language-ID
 * model disputes (#208). Caps, in hours of audio,
 * best-scoring clips first: ``min_hours_per_speaker`` drops a speaker with
 * less, ``max_hours_per_speaker`` caps one, ``max_hours_per_accent`` caps an
 * accent, and ``balance_accents`` caps every accent at the smallest one's
 * hours. An accent cap takes clips from its speakers in turn, so it keeps
 * them as even as it can.
 *
 * Provenance, required to export (not to select): ``corpus`` and
 * ``license`` name the licensed corpus every clip comes from; or
 * ``consent_record`` names a cortex ``ConsentRecord`` (a path under the
 * scanned folder, as ``ConsentConfig.record``) for a real person's voice
 * outside a licensed corpus, checked for ``training`` of the ``voice`` at
 * ``consent_delivery``. The record binds the export to its reference
 * recordings' voice (#209): a clip is kept only when its speaker embedding
 * is within ``consent_max_distance`` (cosine distance) of their centroid.
 * Nothing estimates a speaker's age: the corpus's label is carried, and an
 * unknown age stays unknown.
 */
export interface SpeechSelection {
  accents?: [string, ...string[]] | null;
  balance_accents?: boolean;
  consent_delivery?: string | null;
  consent_max_distance?: number;
  consent_record?: string | null;
  corpus?: string | null;
  exclude_language_mismatch?: boolean;
  exclude_speaker_mismatch?: boolean;
  languages?: [string, ...string[]] | null;
  license?: string | null;
  max_hours_per_accent?: number | null;
  max_hours_per_speaker?: number | null;
  min_hours_per_speaker?: number | null;
  speakers?: [string, ...string[]] | null;
}
/**
 * A deterministic train/held-out split of the kept images (#183).
 *
 * Set exactly one of ``held_out`` (images) or ``held_out_fraction``. Whole
 * groups (``group_by``) go to one part, never both; a group that would take
 * the held-out part past its target is skipped, so the held-out count can
 * fall short of it, never exceed it. Both parts must end up non-empty.
 *
 * ``method`` "spread" takes held-out groups evenly through the ranking, so
 * the held-out images are as good as the training ones (argus-mint's rule);
 * "random" shuffles the groups with ``seed``. The same request on the same
 * scan always gives the same split.
 */
export interface SplitConfig {
  group_by?: "image" | "face_cluster" | "similar_group" | "speaker";
  held_out?: number | null;
  held_out_fraction?: number | null;
  method?: "spread" | "random";
  seed?: number;
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
  modality: "image" | "speech";
  mode: "copy" | "symlink" | "move";
  run_stats_path: string | null;
  selected_rel_paths: string[];
  sidecars_carried: number;
  sidecars_failed: number;
  skipped: number;
  speech_manifest_version: string;
  transcripts_written: number;
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
  reference_embedding?: [number, ...number[]] | null;
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
 * How a generated source was made (argus-mask#26): the model, its sha256, the seed and the prompt.
 */
export interface Generator {
  model: string;
  model_sha256?: string | null;
  prompt?: string;
  seed?: number | null;
}
/**
 * SingGuard policy check via a remote SingGuard server (see guard.py).
 *
 * Like NudeNet, the URL (ARGUS_CURATOR_SINGGUARD_URL) is process
 * configuration. A request picks a policy by name, never by text.
 *
 * ``thinking``: a request may pick the SingGuard mode (``fast``,
 * ``fast-slow``, ``slow`` or ``cascade``); null runs the server's default
 * (ARGUS_CURATOR_SINGGUARD_THINKING). The server refuses a mode outside
 * ARGUS_CURATOR_SINGGUARD_THINKING_ALLOWED with 422. A finished scan records
 * the mode it ran in, whichever set it. ``fell_back`` is recorded by the scan
 * only (a value a request sends is replaced): whether the server refused the
 * mode so checks dropped to ``fast``.
 */
export interface GuardConfig {
  enabled?: boolean | null;
  fell_back?: boolean | null;
  policy?: "default" | "adult" | "adult-granular" | "adult-cautious" | "adult-cinematic";
  thinking?: ("fast" | "fast-slow" | "slow" | "cascade") | null;
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
  consent: ConsentBinding | null;
  /**
   * Derived from :attr:`nsfw` on read, so a scan cached before ratings existed has one too.
   */
  content_rating: ("safe" | "suggestive" | "explicit") | null;
  crop: CropBox | null;
  crop_source: ("manual" | "detected") | null;
  duplicate_kind: ("phash" | "semantic" | "both") | null;
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
  likeness_distance: number | null;
  nsfw: NsfwResult | null;
  nudenet_failed: boolean;
  passed: boolean;
  people: PersonDetection[];
  people_check: ("ok" | "detection_failed" | "body_ages_failed") | null;
  people_error: string | null;
  phash: string;
  pose_check: ("ok" | "unusable" | "no_person" | "failed") | null;
  pose_cluster: number | null;
  pose_labels: BodyPoseLabels | null;
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
  zero_shot: ZeroShotResult | null;
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
 * Zero-shot CLIP scores for one image (#197; see zeroshot.py).
 *
 * Plain scores only: the image's embedding itself is never stored. A field
 * is None when its check was not asked for.
 */
export interface ZeroShotResult {
  junk: number | null;
  junk_kind: ("screenshot" | "collage" | "text" | "meme") | null;
  profile_fit: number | null;
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
  consent_record_sha256: string | null;
  consent_release_sha256: string | null;
  crop: CropBox | null;
  exported_abs_path: string;
  exported_path: string;
  manifest_version: string;
  pose_cluster: number | null;
  pose_labels: BodyPoseLabels | null;
  primary_face: ManifestFace | null;
  primary_face_cluster: string | null;
  primary_face_pose: ("frontal" | "three_quarter" | "profile") | null;
  provenance: Provenance | null;
  rel_path: string;
  score: number;
  set_age: SetAge | null;
  similar_group: number;
  split: ("train" | "held_out") | null;
  target_profile: TargetProfile;
}
/**
 * Where a source came from. Required wherever the suite serves or trains on a likeness.
 *
 * - ``personal``: the user's own use; needs only ``source``; not cleared to show or share.
 * - ``stock``: a published asset under its licence. ``synthetic``: generated, with no real person
 *   or owned character going in.
 * - ``consented``: a real person's likeness (or an owned character) under a signed release, bound
 *   by the release's sha256 (never the document) and its subject: the name as the release gives
 *   it, or the opaque ref ``consent:<release_sha256>``, which names no one.
 * - ``curated``: reserved; not cleared.
 *
 * Unknown fields are refused, so a misspelt field cannot be dropped in silence (argus-mask#64).
 * ``licence`` is read as ``license``, and the derived ``cleared`` a dumped record carries is
 * dropped and recomputed, never believed.
 */
export interface Provenance {
  /**
   * Whether the source may be shown beyond the user's own screens: a demo, a release, anything public.
   */
  cleared: boolean;
  generator?: Generator | null;
  kind: "personal" | "stock" | "synthetic" | "consented" | "curated";
  license?: string;
  notes?: string;
  release_sha256?: string | null;
  source: string;
  subject?: string;
}
/**
 * What a dataset was curated for, shared verbatim across the suite.
 *
 * argus-cortex's ``TargetProfile`` for an image dataset: ``modality`` is
 * always ``image`` and ``target_category`` an image category. argus-curator
 * curates images, so a speech profile is refused.
 */
export interface TargetProfile {
  checkpoint?: string | null;
  modality?: "image";
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
 * One scan-level body-pose cluster from argus-puppet's ``POST /stats`` (average linkage over the scan).
 */
export interface PoseCluster {
  id: number;
  medoid_rel_path: string | null;
  share: number;
  size: number;
}
/**
 * Body pose from a remote argus-puppet server (see bodypose.py).
 *
 * The server URL is process configuration (ARGUS_CURATOR_PUPPET_URL), never a
 * request field, as for NudeNet. Same opt-out rule: None (default) = on
 * whenever the URL is set; True = required (the scan is refused without a
 * URL); False = opted out. A finished scan records whether the stage ran as
 * True or False.
 */
export interface PoseConfig {
  enabled?: boolean | null;
}
/**
 * What the body-pose stage found over the whole scan (see bodypose.py and docs/body-pose.md).
 *
 * ``posed`` images came back from argus-puppet (``no_person`` of them with
 * nobody in frame), ``failed`` did not. The rest comes from one ``POST
 * /stats`` over every posed image, or is None/empty with ``skipped`` saying
 * why (the scan is over the set cap, the server refused or failed the call,
 * nothing was posed). ``stale``: rows were dropped since, so cluster sizes and
 * shares are recounted from the rows left but ``diversity`` and
 * ``comparable_share`` are as measured.
 */
export interface PoseSummary {
  clusters: PoseCluster[];
  comparable_share: number | null;
  diversity: number | null;
  failed: number;
  largest_cluster_share: number | null;
  no_person: number;
  posed: number;
  puppet_version: string | null;
  skipped: string | null;
  stale: boolean;
  usable: number | null;
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
  drop_junk?: boolean;
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
  junk_check?: boolean;
  junk_threshold?: number;
  junk_weight?: number;
  max_aspect_ratio?: number;
  max_workers?: number;
  min_short_side?: number;
  profile_fit?: boolean;
  profile_fit_weight?: number;
  resolution_ref?: number;
  semantic_duplicate_cosine?: number;
  semantic_duplicates?: boolean;
  sharpness_ref?: number;
  weight_artifact?: number;
  weight_resolution?: number;
  weight_sharpness?: number;
  weight_subject?: number;
}
export interface ScanRequest {
  config?: ScanConfig;
  consent?: ConsentConfig;
  crops?: CropConfig;
  embeddings?: EmbeddingConfig;
  faces?: FaceConfig;
  folder: string;
  garments?: GarmentConfig;
  guard?: GuardConfig;
  nsfw?: NsfwConfig;
  pose?: PoseConfig;
  prefilter?: PrefilterConfig;
  scenes?: SceneConfig;
  speech?: SpeechConfig;
  target_profile?: TargetProfile | SpeechTargetProfile;
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
 * Thresholds and options for a speech scan (``target_profile.modality == "speech"``).
 *
 * Every threshold is a prefilter: a clip past it is rejected with the check
 * named (:data:`SpeechCheck`). ``None`` turns a threshold off. Silence is
 * measured against the clip's loudest 30 ms frame: a frame ``silence_db``
 * or more below it is silent. ``chars_per_s`` counts a transcript's letters
 * and digits over the clip less its leading and trailing silence.
 */
export interface SpeechConfig {
  duplicate_distance?: number;
  language_dispute_below?: number;
  language_id?: boolean;
  language_id_device?: string;
  max_cer?: number | null;
  max_channels?: number;
  max_chars_per_s?: number | null;
  max_clipping_ratio?: number | null;
  max_duration_s?: number;
  max_leading_silence_s?: number | null;
  max_trailing_silence_s?: number | null;
  max_workers?: number;
  min_chars_per_s?: number | null;
  min_duration_s?: number;
  min_mos?: number | null;
  min_sample_rate?: number;
  min_snr_db?: number | null;
  min_speech_ratio?: number | null;
  mos?: boolean;
  mos_device?: string;
  reject_language_mismatch?: boolean;
  require_transcript?: boolean;
  silence_db?: number;
  snr_ref_db?: number;
  speaker_device?: string;
  speaker_threshold?: number;
  speakers?: boolean;
  transcripts?: "auto" | "sidecar" | "ljspeech" | "common_voice";
  vad?: "energy" | "silero";
  weight_mos?: number;
  weight_snr?: number;
  weight_speech_ratio?: number;
}
/**
 * argus-cortex's ``TargetProfile`` for a speech dataset: ``modality`` is ``speech``.
 *
 * ``target_category`` is a speech category (``voice`` by default), and
 * ``target_backend`` names a TTS model family (``xtts-v2``, ``qwen3-tts``) or
 * is ``None``. Accepted by the speech scan only; image scoring and the image
 * manifest never see it.
 */
export interface SpeechTargetProfile {
  checkpoint?: string | null;
  modality?: "speech";
  target_backend?: string | null;
  target_category?: "voice" | "accent" | "language" | "speaking_style";
  target_style?: "photo" | "anime";
}
/**
 * Full result of a scan — persisted on disk and paginated by the server.
 */
export interface ScanSummary {
  clips: ClipResult[];
  config: ScanConfig;
  consent: ConsentCheck | null;
  crop_config: CropConfig;
  duplicates: number;
  embeddings_config: EmbeddingConfig;
  erax_config: EraxConfig;
  face_clusters: FaceCluster[];
  faces_config: FaceConfig;
  folder: string;
  garments_config: GarmentConfig;
  guard_config: GuardConfig;
  language_mismatches: number;
  legacy_min_short_side: number | null;
  likeness_skipped: string | null;
  likeness_source: ("reference" | "centroid") | null;
  limit: number | null;
  nsfw_config: NsfwConfig;
  offset: number;
  passed: number;
  pose: PoseSummary | null;
  pose_config: PoseConfig;
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
  semantic_groups_stale: boolean;
  set_age: SetAge | null;
  set_age_skipped: string | null;
  similar_clusters: number;
  speaker_clusters: SpeakerCluster[];
  speaker_mismatches: number;
  speech_config: SpeechConfig | null;
  target_profile: TargetProfile | SpeechTargetProfile;
  total: number;
}
/**
 * A speaker found by clustering a speech scan's embeddings (#187).
 *
 * ``corpus_speakers`` counts the corpus speaker labels among its clips (empty
 * when the corpus names none). ``mismatch`` is True when the clustering and
 * the corpus disagree about it: it holds more than one label, or a label it
 * holds also has clips in another cluster. A centroid is a voiceprint, so
 * none is stored.
 */
export interface SpeakerCluster {
  clips: number;
  cluster_id: string;
  corpus_speakers: {
    [k: string]: number;
  };
  mismatch: boolean;
  seconds: number;
}
/**
 * Filter body for ``POST /scan/{id}/select``.
 *
 * The filter, ranking, cap and split fields of :class:`ExportRequest`, and
 * none of the transfer fields (``dest``, ``mode``, ``selection``). Select and
 * export run the same ``selection.plan_selection``, so an export with the
 * same fields keeps exactly the rows this route marks kept, in this order.
 */
export interface SelectRequest {
  content_ratings?: ["safe" | "suggestive" | "explicit", ...("safe" | "suggestive" | "explicit")[]] | null;
  diversify_outfits?: boolean;
  diversify_scenes?: boolean;
  diversify_semantic?: boolean;
  diversity_weight?: number | null;
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
  exclude_references?: boolean;
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
  max_keep?: number | null;
  max_likeness_distance?: number | null;
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
  rank?: "score" | "identity" | "likeness";
  scene_environments?: ("indoor" | "outdoor")[] | null;
  scenes?: string[] | null;
  speech?: SpeechSelection | null;
  split?: SplitConfig | null;
}
/**
 * What the current filter would keep, without writing the export root.
 *
 * ``rows`` lists the kept images first, best first by ``rank`` (each row's
 * ``rank`` is its position), then the images left out, in scan order.
 */
export interface SelectResult {
  held_out: number | null;
  kept: number;
  rank: "score" | "identity" | "likeness";
  rows: SelectRow[];
  scan_id: string;
  speech: SpeechSelectStats | null;
  total: number;
  train: number | null;
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
  consent_distance: number | null;
  keep_reason: string;
  rank: number | null;
  rel_path: string;
  speaker_id: string | null;
  split: ("train" | "held_out") | null;
}
/**
 * What a speech selection keeps, in hours of audio (#187).
 */
export interface SpeechSelectStats {
  hours: number;
  hours_by_accent: {
    [k: string]: number;
  };
  hours_by_speaker: {
    [k: string]: number;
  };
  hours_by_split: {
    [k: string]: number;
  };
  speakers_by_split: {
    [k: string]: number;
  };
}
/**
 * One line of a speech export's ``speech_manifest.jsonl`` (#187; ``speech_export.write_manifest``).
 *
 * Its own shape and version (:data:`SPEECH_MANIFEST_VERSION`), never mixed
 * with image rows: a consumer reads ``speech_manifest_version`` and refuses a
 * major it does not know. Rows exist only for clips whose transfer and
 * transcript sidecar both succeeded.
 *
 * Paths follow :class:`ManifestRow`: ``exported_path`` and
 * ``exported_abs_path`` are the de-collided files on disk, ``abs_path`` is
 * where the clip can be read (the destination under ``mode="move"``), and
 * ``transcript_path`` / ``transcript_abs_path`` name the ``<stem>.txt``
 * beside the exported clip holding ``transcript``.
 *
 * ``speaker_id`` is the corpus's speaker label when it has one, else the
 * speaker cluster; ``speaker_label`` and ``speaker_cluster`` are each on its
 * own. A split keeps every speaker (label and cluster alike) in one
 * part. ``accent``, ``language``, ``gender`` and ``age`` are the corpus's
 * labels verbatim; ``age`` is null when the corpus gives none, and is never
 * estimated. ``corpus``, ``license`` and ``provenance`` say where every clip
 * came from; a clip used under a consent record also names its hashes.
 */
export interface SpeechManifestRow {
  abs_path: string;
  accent: string | null;
  age: string | null;
  channels: number;
  consent_record_sha256: string | null;
  consent_release_sha256: string | null;
  corpus: string;
  duration_s: number;
  exported_abs_path: string;
  exported_path: string;
  gender: string | null;
  language: string | null;
  license: string;
  modality: "speech";
  provenance: Provenance;
  rel_path: string;
  sample_rate: number;
  score: number;
  similar_group: number;
  speaker_cluster: string | null;
  speaker_id: string | null;
  speaker_label: string | null;
  speaker_mismatch: boolean;
  speech_manifest_version: string;
  split: ("train" | "held_out") | null;
  target_profile: SpeechTargetProfile;
  transcript: string;
  transcript_abs_path: string;
  transcript_path: string;
}
