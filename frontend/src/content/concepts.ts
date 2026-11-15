/**
 * Shared content registry — the single source of truth for concept
 * documentation. Both the in-tool micro-docs (e.g. ParamInfo) and the `/docs`
 * handbook read from here, so a parameter's explanation is authored once and
 * never drifts between a tooltip and its doc page.
 *
 * `summary` is the one-line tooltip; `body` is markdown for the expanded panel
 * and the doc page; `href` is set only once a dedicated doc page exists, so
 * consumers can conditionally render a "Learn more" link without dead ends.
 */

export interface Concept {
  /** Stable id, typically the backend parameter name. */
  id: string;
  /** Human-facing title. */
  title: string;
  /** One-line explanation, suitable for a tooltip. */
  summary: string;
  /** Longer markdown explanation for the expanded panel and doc page. */
  body: string;
  /** Canonical usage example. */
  example?: string;
  /** Related concept ids, for cross-linking. */
  related?: string[];
  /** Doc-page path. Present only when a page has been authored. */
  href?: string;
}

export const CONCEPTS = {
  target_style: {
    id: "target_style",
    title: "Target Style",
    summary: "How tags are classified and budgeted for your model family.",
    body: [
      "Determines how tags are classified and budgeted for the caption.",
      "",
      "- **photo** optimises for realism models using natural-language tokens.",
      "- **anime** optimises for booru-tagged models using tag-style tokens at higher density.",
      "",
      "Pick the one that matches the base checkpoint you will train against.",
    ].join("\n"),
    example: 'target_style="photo"',
    related: ["target_backend", "target_category"],
    href: "/docs/captioning/target-style",
  },
  target_backend: {
    id: "target_backend",
    title: "Target Backend",
    summary: "The diffusion architecture that will consume the caption — it sets the token budget.",
    body: [
      "The diffusion model architecture that will consume these captions. Each backend has a different CLIP/T5 **token budget** — exceeding it means wasted tokens the model never sees.",
      "",
      "- SDXL / SD 1.5 / Playground: ~60 tokens.",
      "- Flux / SD3 / Kolors / PixArt: ~200 tokens.",
      "",
      "Captions are assembled to fit the selected backend's budget, dropping the lowest-priority fragments first.",
      "",
      "Newer argus-lens releases also return a `training_prose` variant, the training caption written as sentences rather than tags. Use it for the T5 backends (Flux, SD3).",
    ].join("\n"),
    example: 'target_backend="sdxl"',
    related: ["target_style", "prose_enrichment"],
    href: "/docs/captioning/target-backend",
  },
  target_category: {
    id: "target_category",
    title: "Target Category",
    summary: 'Which caption variant becomes the "final_caption" written for training.',
    body: [
      "Controls which caption variant becomes the `final_caption` in the output. The Caption tool exposes the full set of categories; these are the ones you reach for most:",
      "",
      "- **identity** — for a person/character LoRA; keep this as the default when the face is the concept.",
      "- **wardrobe** — for clothing/outfit LoRAs where the garment is the focus.",
      "- **setting** — for scene LoRAs that reward wide, establishing framing.",
      "",
      "The category also shapes what *good input* looks like: an identity set wants sharp, varied face angles; a setting set wants wide, high-resolution scenes. Curate scores images with a related category taxonomy, so picking the same concept in both steps keeps captioning and selection aligned.",
    ].join("\n"),
    example: 'target_category="identity"',
    related: ["target_style", "prose_enrichment"],
    href: "/docs/captioning/target-category",
  },
  prose_enrichment: {
    id: "prose_enrichment",
    title: "Prose Enrichment",
    summary: "Append novel Florence-2 prose tokens to the training caption at low priority.",
    body: [
      "When enabled, novel noun/adjective phrases from prose output (Florence-2) are extracted and appended to the training variant as **low-priority tag-style tokens**.",
      "",
      "This adds scene context without displacing core identity or wardrobe tags. Disable it for a pure WD14-only training caption.",
    ].join("\n"),
    example: "prose_enrichment=true",
    related: ["target_backend"],
    href: "/docs/captioning/prose-enrichment",
  },
  hybrid_balance: {
    id: "hybrid_balance",
    title: "Tag ↔ Prose Balance",
    summary: "How much the final caption leans on booru-style tags versus natural-language prose.",
    body: [
      "Lower means denser tags; higher means flowing description.",
      "",
      "The presets are named stops (`hybrid_preset`). The Advanced slider sends a raw `prose_bias` from 0.0 to 1.0, which overrides the preset.",
    ].join("\n"),
    example: 'hybrid_preset="balanced"',
    related: ["prose_enrichment", "target_backend"],
  },
  // --- argus-proof scoring axes (the /proof report). Each is 0–1, higher is
  // better, and null when its scorer didn't run: a missing scorer is left out
  // of the composite, never counted as zero.
  metric_identity: {
    id: "metric_identity",
    title: "Identity",
    summary: "Similarity to the reference subject.",
    body: [
      "How closely a generated face matches the reference images held out of training, on a 0–1 scale where higher is closer.",
      "",
      "Scored with a face-recognition model (proof records `insightface` as the scorer). It needs references in the export, so it is empty for a LoRA trained without a face, or when the scorer isn't installed.",
    ].join("\n"),
    related: ["metric_clip_score", "metric_diversity"],
  },
  metric_clip_score: {
    id: "metric_clip_score",
    title: "Adherence",
    summary: "How well the image matches its prompt (CLIPScore).",
    body: [
      "How well the image matches the prompt it was generated from, as a CLIPScore on a 0–1 scale.",
      "",
      "Low adherence with high identity can be a sign of overfitting: the subject shows up, but the prompt's scene or style doesn't.",
    ].join("\n"),
    related: ["metric_identity", "metric_preference"],
  },
  metric_aesthetic: {
    id: "metric_aesthetic",
    title: "Quality",
    summary: "Image-quality / aesthetic score (IQA).",
    body: "A no-reference image-quality score (proof records `pyiqa` as the scorer): blur, noise, compression and artifacts pull it down. 0–1, higher is better.",
    related: ["metric_preference"],
  },
  metric_preference: {
    id: "metric_preference",
    title: "Preference",
    summary: "Learned human-preference score (ImageReward/HPS).",
    body: "A model trained on human rankings of generated images (ImageReward or HPS) predicts how much people would prefer this one. 0–1, higher is better. It complements quality: an image can be sharp and still unappealing.",
    related: ["metric_aesthetic", "metric_clip_score"],
  },
  metric_safety: {
    id: "metric_safety",
    title: "Safety",
    summary: "Safety score (higher = safer).",
    body: "How safe the image is, 0–1, where higher is safer. Images under the gate's safety floor count toward the run's unsafe rate. A reviewer can also file an `unsafe` reject under a policy category, which the report then breaks down.",
    related: ["metric_identity"],
  },
  metric_diversity: {
    id: "metric_diversity",
    title: "Diversity",
    summary: "Output variety (higher = more varied).",
    body: [
      "How varied the run's images are, across the whole run rather than per image. 0–1, higher is more varied.",
      "",
      "Near-duplicates (proof records `phash` for them) are grouped, and the pass rate counts groups, not frames, so repeats of one image count once.",
    ].join("\n"),
    related: ["metric_identity", "metric_clip_score"],
  },
} satisfies Record<string, Concept>;

export type ConceptId = keyof typeof CONCEPTS;

/** Look up a concept by id. Returns `undefined` for unknown ids. */
export function getConcept(id: string): Concept | undefined {
  // Own keys only: "constructor" or "__proto__" must not resolve through the prototype.
  return Object.hasOwn(CONCEPTS, id) ? (CONCEPTS as Record<string, Concept>)[id] : undefined;
}
