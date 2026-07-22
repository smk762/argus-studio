/**
 * The Argus suite as one ordered pipeline (#67): acquire, curate, caption,
 * configure, evaluate. This is the single source of truth for the nav order,
 * the stage numbers, and the accent + call-to-action a hand-off carries when it
 * leads to a stage — so a stage's identity is stated once here instead of being
 * re-typed at every `<Nav>` tab and every `<StageHandoff>` call site.
 *
 * `/` stays the caption tool even though it is stage 3: it is argus-lens, the
 * suite's front door, and moving it would break every existing link.
 */

/** A stage's page accent (its SiteHeader logo tone); a hand-off leading to the
 *  stage is coloured to match, so the destination reads before you arrive. */
export type StageTone = "purple" | "amber" | "green" | "teal";

export interface PipelineStage {
  href: string;
  /** Top-nav tab label. */
  label: string;
  /** 1-based position in the pipeline, or null for a reference surface (/docs). */
  stage: number | null;
  /** The page's own accent. */
  tone: StageTone;
  /** Default call-to-action for a hand-off leading to this stage. */
  handoff?: string;
}

export const PIPELINE: readonly PipelineStage[] = [
  { href: "/gallery", label: "Gallery", stage: 1, tone: "amber" },
  { href: "/curate", label: "Curate", stage: 2, tone: "teal", handoff: "Curate this subject" },
  { href: "/", label: "Caption", stage: 3, tone: "purple", handoff: "Caption the export in Lens" },
  { href: "/forge", label: "Forge", stage: 4, tone: "amber", handoff: "Configure training in Forge" },
  { href: "/proof", label: "Proof", stage: 5, tone: "green", handoff: "Evaluate a trained LoRA in Proof" },
  { href: "/docs", label: "Docs", stage: null, tone: "purple" },
] as const;

/** Numbered pipeline steps only (excludes reference surfaces like /docs). */
export const STAGE_COUNT = PIPELINE.filter((s) => s.stage != null).length;

/**
 * The stage that owns a route, looked up by its base href (the part before any
 * query string). Throws on an unknown href so a typo surfaces immediately as an
 * error rather than a silently mis-coloured or unlabelled hand-off.
 */
export function stageFor(href: string): PipelineStage {
  const base = href.split("?")[0];
  const found = PIPELINE.find((s) => s.href === base);
  if (!found) throw new Error(`No pipeline stage for href: ${href}`);
  return found;
}
