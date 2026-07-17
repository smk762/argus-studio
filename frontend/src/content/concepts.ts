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
} satisfies Record<string, Concept>;

export type ConceptId = keyof typeof CONCEPTS;

/** Look up a concept by id. Returns `undefined` for unknown ids. */
export function getConcept(id: string): Concept | undefined {
  return (CONCEPTS as Record<string, Concept>)[id];
}
