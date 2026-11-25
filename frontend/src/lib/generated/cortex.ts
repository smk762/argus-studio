// Generated from smk762/argus-cortex@a65209b (0.16.2.dev8+ga65209b) taxonomy-schema.json.
// Do not edit: change schema/pins.json and run `npm run wire:pull`.

export interface CortexWire {
  TargetProfile?: TargetProfile;
}
/**
 * What a dataset was curated for — shared verbatim across the suite.
 *
 * Inherited unchanged from stage to stage (curator → lens → forge → proof) so
 * a decision made once at curation time is honoured everywhere downstream; no
 * stage remaps the taxonomy.
 *
 * ``modality`` defaults to ``image``, so a profile without it reads exactly as
 * before. A ``speech`` profile pairs with a :data:`SpeechCategory` (default
 * ``voice``) and an image profile with a :data:`TargetCategory`; a mismatch is
 * refused. For speech, ``target_backend`` names a TTS model family
 * (``qwen3-tts``, ``xtts-v2``) and defaults to ``None`` rather than ``sdxl``,
 * and ``target_style`` is ignored. Per-clip language and accent labels belong
 * in the stage's manifest rows, not here.
 */
export interface TargetProfile {
  checkpoint?: string | null;
  modality?: "image" | "speech";
  target_backend?: string | null;
  target_category?:
    | ("identity" | "wardrobe" | "pose_composition" | "setting" | "concept")
    | ("voice" | "accent" | "language" | "speaking_style");
  target_style?: "photo" | "anime";
}
