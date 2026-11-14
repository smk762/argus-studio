// Generated from smk762/argus-cortex@v0.4.7 taxonomy-schema.json.
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
 */
export interface TargetProfile {
  checkpoint?: string | null;
  target_backend?: string | null;
  target_category?: "identity" | "wardrobe" | "pose_composition" | "setting" | "concept";
  target_style?: "photo" | "anime";
}
