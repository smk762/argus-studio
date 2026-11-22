/**
 * The Argus suite as one ordered pipeline (#67): acquire, curate, caption,
 * configure, evaluate, and bake a map with the result. This is the single source of truth for the nav order,
 * the stage numbers, and the accent + call-to-action a hand-off carries when it
 * leads to a stage — so a stage's identity is stated once here instead of being
 * re-typed at every `<Nav>` tab and every `<StageHandoff>` call site.
 *
 * `/` stays the caption tool even though it is stage 3: it is argus-lens, the
 * suite's front door, and moving it would break every existing link.
 */

/** A stage's page accent (its SiteHeader logo tone); a hand-off leading to the
 *  stage is coloured to match, so the destination reads before you arrive. */
export type StageTone = "purple" | "amber" | "green" | "teal" | "blue";

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
  { href: "/atlas", label: "Atlas", stage: 6, tone: "blue", handoff: "Bake a map in Atlas" },
  { href: "/darkroom", label: "Darkroom", stage: 7, tone: "purple", handoff: "Generate in Darkroom" },
  { href: "/docs", label: "Docs", stage: null, tone: "purple" },
] as const;

/** Numbered pipeline steps only (excludes reference surfaces like /docs). */
export const STAGE_COUNT = PIPELINE.filter((s) => s.stage != null).length;

/**
 * The stage that owns a route, looked up by its base href — the path with any
 * query string (`?…`), hash fragment (`#…`) or trailing slash stripped, so an
 * ordinary link target like `/proof#runs` or `/curate/` still resolves.
 *
 * Returns `undefined` for an href that maps to no stage (a typo, a sub-route
 * like `/proof/run/1`, or an off-pipeline destination) so the caller can degrade
 * to a plain link — a cosmetic accent/label lookup must not crash the whole
 * route at render time.
 */
export function stageFor(href: string): PipelineStage | undefined {
  const path = href.split(/[?#]/)[0];
  const base = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return PIPELINE.find((s) => s.href === base);
}

/**
 * Where a stage leads besides the next number (#236). The numbered core stays
 * the nav; a stage that branches lists its branches here, and its page shows
 * them as a "From here" row. An external branch is a standalone UI that owns
 * the work (Mask, Assay, Puppet): Studio links to it rather than duplicating it,
 * and only when the deployment configures its URL. Puppet is stage-less (#281):
 * it has no number, only these branches from the stages that read its pose data.
 */
export type ExternalUi = "mask" | "assay" | "puppet";

export type Branch =
  | { kind: "stage"; href: string; label: string }
  | { kind: "external"; ui: ExternalUi; label: string; service: string };

export const BRANCHES: Readonly<Record<string, readonly Branch[]>> = {
  "/curate": [{ kind: "external", ui: "puppet", label: "Check pose balance in Puppet", service: "argus-puppet" }],
  "/proof": [{ kind: "external", ui: "puppet", label: "Compare output poses to training in Puppet", service: "argus-puppet" }],
  "/darkroom": [
    { kind: "stage", href: "/forge", label: "Train a new LoRA in Forge" },
    { kind: "external", ui: "mask", label: "Rig a face in Mask", service: "argus-mask" },
    { kind: "external", ui: "assay", label: "Mint a provenance card in Assay", service: "argus-mint" },
  ],
};

export interface ResolvedBranch {
  href: string;
  label: string;
  tone: StageTone;
  /** A standalone UI off this site, named by the service it fronts. */
  external: { service: string } | null;
}

/**
 * The branches a stage's page shows: its stage branches always, and an external
 * one only when `urls` names it (an empty or missing URL means not deployed).
 */
export function branchesFrom(href: string, urls: Partial<Record<ExternalUi, string>>): ResolvedBranch[] {
  const from = stageFor(href)?.href ?? href;
  return (BRANCHES[from] ?? []).flatMap((branch): ResolvedBranch[] => {
    if (branch.kind === "stage") {
      return [{ href: branch.href, label: branch.label, tone: stageFor(branch.href)?.tone ?? "purple", external: null }];
    }
    const url = urls[branch.ui]?.trim();
    return url ? [{ href: url, label: branch.label, tone: "purple", external: { service: branch.service } }] : [];
  });
}
