/**
 * Thin client for the argus-proof API (:8104) — post-training LoRA evaluation.
 * Shapes come from `@/lib/generated/proof`, built from the pinned
 * schema/proof-wire.schema.json in smk762/argus-proof: a scored EvalReport per
 * generation run, with per-image metric scores, structured reject reasons, HITL
 * ratings, and a pass/fail verdict. That schema marks fields with defaults as
 * optional, though proof always sends them, so {@link Filled} names the ones this
 * app reads without a check. Follows the forgeApi.ts / galleryApi.ts pattern.
 */

import { proofUrl } from "@/lib/curatorEnv";
import type * as Wire from "@/lib/generated/proof";
import type { Filled } from "@/lib/wire";
import { asError } from "@/lib/apiError";
import { capabilityOf, healthMemo, requireCapability, type Capability } from "@/lib/capabilities";
import { readNdjson } from "@/lib/lensApi";

// --- wire types -------------------------------------------------------------

/** The automated scoring axes; each is [0,1] (higher = better) or null if the
 * scorer for it didn't run. */
export type MetricScores = Required<Wire.MetricScores>;

/** Closed vocabulary of reject causes (argus_proof RejectReasonCode). */
export type RejectReasonCode = Wire.RejectReason["code"];

/** `category` is the policy slug an `unsafe` reject is filed under (wire 1.3). A free string on
 * the wire, so a slug newer than {@link POLICY_CATEGORIES} is still valid. */
export type RejectReason = Wire.RejectReason;

/** `passed`: null = undecided (routed to HITL by the gate); true/false = pass/fail. */
export type ImageScores = Filled<
  Omit<Wire.ImageScores, "metrics">,
  "hitl_rating" | "hitl_rater" | "reject_reasons" | "passed" | "duplicate_group"
> & { metrics: MetricScores };

export type AggregateScores = Filled<Omit<Wire.AggregateScores, "means">, "n_groups" | "n_needs_hitl" | "diversity"> & {
  means: MetricScores;
};

export type ScorerProvenance = Required<Wire.ScorerProvenance>;

export type Verdict = Required<Wire.Verdict>;

export interface EvalReport {
  proof_version?: string;
  run_id: string;
  images: ImageScores[];
  aggregate: AggregateScores;
  scorers: ScorerProvenance[];
  verdict: Verdict;
  created_at: string | null;
}

/** One-line digest of a stored report for the run browser (GET /reports). */
export interface ReportSummary {
  run_id: string;
  passed: boolean;
  pending: boolean;
  pass_rate: number;
  n_images: number;
  n_groups: number | null;
  n_needs_hitl: number;
  /** Images carrying a second-pass refinement (0 on older servers). */
  n_refined?: number;
  created_at: string | null;
}

/**
 * The run-browser line for a report, from its aggregate and verdict. Used to
 * keep the run list in step with a report recomputed by a HITL review, so the
 * list and the open report never show two different pass rates.
 */
export function summaryFromReport(report: EvalReport): ReportSummary {
  return {
    run_id: report.run_id,
    passed: report.verdict.passed,
    pending: report.verdict.pending,
    pass_rate: report.aggregate.pass_rate,
    n_images: report.aggregate.n_images,
    n_groups: report.aggregate.n_groups,
    n_needs_hitl: report.aggregate.n_needs_hitl,
    created_at: report.created_at,
  };
}

/**
 * `summaries` with the entry for `report.run_id` refreshed from the report.
 * Other runs and the list order are kept, as are the entry's `created_at` and
 * `n_refined` (a review doesn't touch either). A run not in the list is not
 * appended: the list is the server's.
 */
export function withReportSummary(summaries: ReportSummary[], report: EvalReport): ReportSummary[] {
  return summaries.map((s) =>
    s.run_id === report.run_id
      ? { ...s, ...summaryFromReport(report), n_refined: s.n_refined, created_at: s.created_at }
      : s,
  );
}

// --- HITL request shapes (POST /report/{id}/hitl) --------------------------

export interface HitlImageUpdate {
  image_id: string;
  hitl_rating?: number | null;
  reject_reasons?: RejectReason[];
}

export interface HitlRequest {
  rater?: string | null;
  updates: HitlImageUpdate[];
}

// --- presentation metadata -------------------------------------------------

/** The scoring axes in display order, with human labels. */
export const METRIC_LABELS: { key: keyof MetricScores; label: string; hint: string }[] = [
  { key: "identity", label: "Identity", hint: "Similarity to the reference subject" },
  { key: "clip_score", label: "Adherence", hint: "How well the image matches its prompt (CLIPScore)" },
  { key: "aesthetic", label: "Quality", hint: "Image-quality / aesthetic score (IQA)" },
  { key: "preference", label: "Preference", hint: "Learned human-preference score (ImageReward/HPS)" },
  { key: "safety", label: "Safety", hint: "Safety score (higher = safer)" },
];

/** Reject taxonomy for the HITL picker. The user-facing labels group the closed
 * wire vocabulary into the failure modes reviewers actually call out. */
export const REJECT_TAXONOMY: { code: RejectReasonCode; label: string; hint: string }[] = [
  { code: "identity_mismatch", label: "ID not applied", hint: "Doesn't look like the subject" },
  { code: "anatomy", label: "Deformation", hint: "Hands, faces, limbs, proportions" },
  { code: "artifact", label: "Decoherence", hint: "Rendering artifacts / glitches" },
  { code: "prompt_mismatch", label: "Ignored prompt", hint: "Contradicted or ignored the prompt" },
  { code: "low_quality", label: "Low quality", hint: "Blurry, low IQA, compression" },
  { code: "overfit", label: "Overfit", hint: "Reproduced training data / failed a flexibility prompt" },
  { code: "duplicate", label: "Duplicate", hint: "Near-duplicate of another output" },
  { code: "unsafe", label: "Unsafe", hint: "Failed safety evaluation" },
  { code: "other", label: "Questionable", hint: "Something else — see note" },
];

const REJECT_LABEL = new Map(REJECT_TAXONOMY.map((r) => [r.code, r.label]));
export const rejectLabel = (code: RejectReasonCode): string => REJECT_LABEL.get(code) ?? code;

/** Proof's policy taxonomy (argus_proof.moderation.PolicyCategory, `proof-policy-1`). */
export const POLICY_CATEGORIES: { slug: string; label: string; hint: string }[] = [
  { slug: "sexual", label: "Sexual", hint: "Sexual or adult content" },
  { slug: "violence", label: "Violence", hint: "Graphic violence, gore" },
  { slug: "hate", label: "Hate", hint: "Hateful or harassing depictions of protected groups" },
  { slug: "self_harm", label: "Self-harm", hint: "Self-harm, suicide" },
  { slug: "weapons", label: "Weapons", hint: "Indiscriminate or regulated weapons" },
  { slug: "illegal", label: "Illegal", hint: "Depictions of illegal acts" },
];

const POLICY_LABEL = new Map(POLICY_CATEGORIES.map((c) => [c.slug, c.label]));
/** A slug this client doesn't know shows as itself rather than being hidden. */
export const policyLabel = (slug: string): string => POLICY_LABEL.get(slug) ?? slug;

/** One reason as a reviewer reads it: "Unsafe · Violence", or just "Deformation". */
export function reasonLabel(r: RejectReason): string {
  return r.code === "unsafe" && r.category ? `${rejectLabel(r.code)} · ${policyLabel(r.category)}` : rejectLabel(r.code);
}

const unsafeCategory = (r: RejectReason): string | null => (r.code === "unsafe" && r.category ? r.category : null);

/** The categories on these reasons' `unsafe` rejects, without repeats. */
export function unsafeCategories(reasons: RejectReason[]): string[] {
  return [...new Set(reasons.map(unsafeCategory).filter((c): c is string => c !== null))];
}

/** The chips to offer on an `unsafe` reject: the taxonomy, plus any stored slug
 * outside it, so a reviewer can see it and can clear it. */
export function categoryChoices(reasons: RejectReason[]): string[] {
  return [...new Set([...POLICY_CATEGORIES.map((c) => c.slug), ...unsafeCategories(reasons)])];
}

/**
 * Turn one policy category on or off for an image's `unsafe` reject. Each
 * category is its own `unsafe` reason, so an image can sit under several.
 *
 * The first category fills an uncategorised reason, keeping its note. Clearing
 * the last one leaves the reason uncategorised: taking a label off must not
 * also take the reject off, since that would change the image's verdict.
 */
export function toggleUnsafeCategory(reasons: RejectReason[], category: string): RejectReason[] {
  const isTarget = (r: RejectReason) => unsafeCategory(r) === category;
  if (reasons.some(isTarget)) {
    const others = reasons.some((r) => r.code === "unsafe" && !isTarget(r));
    if (others) return reasons.filter((r) => !isTarget(r));
    return reasons.map((r) => (isTarget(r) ? { ...r, category: null } : r));
  }
  const blank = reasons.findIndex((r) => r.code === "unsafe" && !r.category);
  if (blank < 0) return [...reasons, { code: "unsafe", category }];
  return reasons.map((r, i) => (i === blank ? { ...r, category } : r));
}

export interface UnsafeSlice {
  /** A policy slug; null for `unsafe` rejects nobody has categorised. */
  category: string | null;
  images: number;
}

export interface UnsafeBreakdown {
  /** Distinct images with an `unsafe` reject. Below the slices' sum when an
   * image sits under more than one category. */
  images: number;
  /** Largest first, ties by slug, uncategorised always last. */
  slices: UnsafeSlice[];
}

/**
 * Count a run's `unsafe` rejects by policy category. Reasons are what's counted:
 * an image under the safety floor with no `unsafe` reason isn't here, although
 * argus_proof.acceptance would count it towards the unsafe rate.
 */
export function unsafeBreakdown(images: ImageScores[]): UnsafeBreakdown {
  const counts = new Map<string | null, number>();
  let total = 0;
  for (const img of images) {
    const unsafe = img.reject_reasons.filter((r) => r.code === "unsafe");
    if (unsafe.length === 0) continue;
    total += 1;
    for (const category of new Set(unsafe.map(unsafeCategory))) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  const slices = [...counts.entries()].map(([category, n]) => ({ category, images: n }));
  slices.sort((a, b) => {
    if (a.category === null || b.category === null) return a.category === null ? 1 : -1;
    return b.images - a.images || a.category.localeCompare(b.category);
  });
  return { images: total, slices };
}

/** The metric axes actually scored on an image (a missing scorer is omitted, not
 * a phantom zero). One source of truth for the mean, composite, and rendered
 * bars so they can't disagree about which axes count. */
export function presentMetrics(metrics: MetricScores): { key: keyof MetricScores; label: string; hint: string }[] {
  return METRIC_LABELS.filter((m) => metrics[m.key] != null);
}

/** Weighted composite over the metrics actually present, mirroring the proof
 * gate's renormalised composite (a missing scorer isn't a phantom zero). */
export function compositeScore(metrics: MetricScores): number | null {
  const present = presentMetrics(metrics).map((m) => metrics[m.key] as number);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

/** A human's pass/fail from their rating + reasons; ``null`` = no human verdict
 * yet (leave the gate's decision). Mirrors argus_proof.reports._hitl_decision so
 * the client preview and the server recompute a review identically. */
export function hitlDecision(rating: number | null, rejectReasons: RejectReason[]): boolean | null {
  if (rejectReasons.length > 0) return false;
  if (rating == null) return null;
  return rating >= 3;
}

export type ImageState = "pass" | "fail" | "needs_hitl";

/** How an image currently stands: a human decision (rating/reject) wins over the
 * gate's auto decision; otherwise the gate's passed flag; else needs review. */
export function imageState(img: ImageScores): ImageState {
  const decision = hitlDecision(img.hitl_rating, img.reject_reasons);
  if (decision !== null) return decision ? "pass" : "fail";
  if (img.passed === true) return "pass";
  if (img.passed === false) return "fail";
  return "needs_hitl";
}

/**
 * Frames still awaiting review: what /proof's "Needs-review only" filter shows.
 * Not the aggregate's `n_needs_hitl`, which counts near-dup *groups*: a pair that
 * both need review is one group and two frames.
 */
export function needsReviewFrames(images: readonly ImageScores[]): number {
  return images.filter((img) => imageState(img) === "needs_hitl").length;
}

// --- client-side review preview --------------------------------------------
// Mirrors argus_proof.scoring.summary so the /proof header can reflect a
// reviewer's edits instantly; a Save persists them and the server returns the
// authoritative recompute. The rules must match the backend: a near-dup group
// passes if any member passes, needs review if any is undecided, else fails —
// and the pass-rate is over groups, not frames.

/** Default GateConfig.run_pass_rate — the bar the group pass-rate must clear. */
export const RUN_PASS_RATE = 0.75;

/** A reviewer's unsaved decision for one image. */
export interface HitlEdit {
  hitl_rating: number | null;
  reject_reasons: RejectReason[];
}

/** Merge edits onto an image (edits win); leaves the row untouched if no edit.
 * Sets ``passed`` from the human decision the same way the server does, so a
 * demo (client-applied) review and a live (server-recomputed) one agree — e.g.
 * a cleared rating falls back to the gate's ``passed`` in both. */
function withEdit(img: ImageScores, edit: HitlEdit | undefined, rater: string | null): ImageScores {
  if (!edit) return img;
  const decision = hitlDecision(edit.hitl_rating, edit.reject_reasons);
  return {
    ...img,
    hitl_rating: edit.hitl_rating,
    reject_reasons: edit.reject_reasons,
    hitl_rater: rater ?? img.hitl_rater,
    passed: decision !== null ? decision : img.passed,
  };
}

function rollup(images: ImageScores[]): { n_groups: number; n_passed: number; n_needs_hitl: number; pass_rate: number } {
  const groups = new Map<number, ImageState[]>();
  images.forEach((img, i) => {
    const key = img.duplicate_group ?? -(i + 1); // undeduped rows are their own group
    const arr = groups.get(key);
    if (arr) arr.push(imageState(img));
    else groups.set(key, [imageState(img)]);
  });
  let nPassed = 0;
  let nNeedsHitl = 0;
  for (const states of groups.values()) {
    if (states.some((s) => s === "pass")) nPassed += 1;
    else if (states.some((s) => s === "needs_hitl")) nNeedsHitl += 1;
  }
  const nGroups = groups.size;
  return { n_groups: nGroups, n_passed: nPassed, n_needs_hitl: nNeedsHitl, pass_rate: nGroups ? nPassed / nGroups : 0 };
}

/** Apply a batch of reviewer edits to a report, recomputing the group-collapsed
 * aggregate + verdict client-side (a live preview of what Save will persist). */
export function applyEdits(report: EvalReport, edits: Map<string, HitlEdit>, rater: string | null): EvalReport {
  const images = report.images.map((img) => withEdit(img, edits.get(img.image_id), rater));
  const r = rollup(images);
  const passed = r.pass_rate >= RUN_PASS_RATE;
  const bestCase = r.n_groups ? (r.n_passed + r.n_needs_hitl) / r.n_groups : 0;
  const pending = !passed && r.n_needs_hitl > 0 && bestCase >= RUN_PASS_RATE;
  const status = passed ? "passed" : pending ? "pending review" : "failed";
  return {
    ...report,
    images,
    aggregate: { ...report.aggregate, ...r },
    verdict: {
      passed,
      pending,
      reasons: [
        `pass_rate ${r.pass_rate.toFixed(2)} vs threshold ${RUN_PASS_RATE.toFixed(2)} — ${status} ` +
          `(${r.n_passed}/${r.n_groups} groups passed, ${r.n_needs_hitl} need review)`,
        ...(report.aggregate.diversity != null ? [`diversity ${report.aggregate.diversity.toFixed(2)}`] : []),
      ],
    },
  };
}

/** Drop the gate's machine-generated ``auto: …`` note from a reason the reviewer
 * merely endorsed, so it isn't recorded as if a human typed it. */
function stripAutoNote(r: RejectReason): RejectReason {
  const { note, ...rest } = r;
  return note?.startsWith("auto:") ? rest : r;
}

/** The same laundering {@link editsToUpdates} applies before sending, for callers
 * that apply edits locally instead. Both paths must agree: otherwise a locally
 * applied review records machine explanations under the reviewer's name, while
 * the identical review sent to the server does not. */
export function normalizeEdits(edits: Map<string, HitlEdit>): Map<string, HitlEdit> {
  return new Map(
    [...edits.entries()].map(([id, e]) => [id, { ...e, reject_reasons: e.reject_reasons.map(stripAutoNote) }]),
  );
}

/** Collect reviewer edits into the wire shape POST /report/{id}/hitl expects. */
export function editsToUpdates(edits: Map<string, HitlEdit>): HitlImageUpdate[] {
  return [...edits.entries()].map(([image_id, e]) => ({
    image_id,
    hitl_rating: e.hitl_rating,
    reject_reasons: e.reject_reasons.map(stripAutoNote),
  }));
}

// --- fetchers --------------------------------------------------------------

export interface ProofHealth {
  status: string;
  service: string;
  version: string;
  /**
   * Replay/demo mode (argus-proof#45): stored reports are still served, but live
   * evaluation and every report write return 403. Set via `--read-only` /
   * `$ARGUS_PROOF_READ_ONLY` on a GPU-less host. Older servers omit it.
   */
  read_only?: boolean;
}

/**
 * Whether this server will accept a live evaluation run and HITL writes.
 *
 * Legacy `true`: a server old enough to omit `read_only` predates replay mode,
 * so it could only ever have been writable.
 */
export function allowsEval(health: ProofHealth | null): Capability {
  // `read_only` is the inverse of the capability, so map it explicitly: returning
  // `undefined` for anything non-boolean is what lets `legacy` apply, whereas a
  // bare `!h.read_only` would turn an absent field into a hard `true` and make
  // the legacy argument unreachable.
  return capabilityOf(health, (h) => (typeof h.read_only === "boolean" ? !h.read_only : undefined), true);
}

async function fetchProofHealth(signal?: AbortSignal): Promise<ProofHealth> {
  const resp = await fetch(`${proofUrl()}/health`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** The posture {@link submitHitl} and {@link runEvalStream} gate on. */
const proofHealth = healthMemo(fetchProofHealth);

const READ_ONLY = "This argus-proof server is read-only (replay mode): stored reports are served, but runs and reviews are refused.";

export async function getProofHealth(signal?: AbortSignal): Promise<ProofHealth> {
  return proofHealth.remember(await fetchProofHealth(signal));
}

/** List stored reports (GET /reports). */
export async function listReports(signal?: AbortSignal): Promise<ReportSummary[]> {
  const resp = await fetch(`${proofUrl()}/reports`, { signal });
  if (!resp.ok) return asError(resp);
  const body = (await resp.json()) as { reports: ReportSummary[] };
  return body.reports;
}

/** Fetch one scored report (GET /report/{run_id}). */
export async function getReport(runId: string, signal?: AbortSignal): Promise<EvalReport> {
  const resp = await fetch(`${proofUrl()}/report/${encodeURIComponent(runId)}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Apply a HITL review and get the recomputed report (POST /report/{id}/hitl). */
export async function submitHitl(runId: string, req: HitlRequest, signal?: AbortSignal): Promise<EvalReport> {
  await requireCapability(proofHealth, allowsEval, READ_ONLY, signal);
  const resp = await fetch(`${proofUrl()}/report/${encodeURIComponent(runId)}/hitl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

// --- evaluation runs ---------------------------------------------------------

/** The URL a generated sample is served from (GET /report/{run}/image/{id}).
 * Ids only — the server resolves them under its runs root, never a client path. */
export function proofImageUrl(runId: string, imageId: string): string {
  return `${proofUrl()}/report/${encodeURIComponent(runId)}/image/${encodeURIComponent(imageId)}`;
}

/** Seed-free image URL for blind review — by position in the report
 * (GET /report/{run}/image_at/{index}), since the by-id URL embeds `<run>-<seed>`. */
export function proofImageAtUrl(runId: string, index: number): string {
  return `${proofUrl()}/report/${encodeURIComponent(runId)}/image_at/${index}`;
}

/** A scorer the proof server can run and whether its deps are installed
 * (GET /scorers). The learned metrics (identity/clip/aesthetic/safety) need the
 * `score` extra; `metric` is null for the dedup/diversity passes. */
export interface ProofScorer {
  metric: string | null;
  name: string;
  available: boolean;
}

export async function listScorers(signal?: AbortSignal): Promise<ProofScorer[]> {
  const resp = await fetch(`${proofUrl()}/scorers`, { signal });
  if (!resp.ok) return asError(resp);
  const body = (await resp.json()) as { scorers: ProofScorer[] };
  return body.scorers;
}

/** A curator export dir the proof server can evaluate against (GET /exports). */
export interface ProofExport {
  name: string;
  n_rows: number;
  /** True when the export carries a held-out references/ dir (identity scoring). */
  has_references: boolean;
}

export async function listExports(signal?: AbortSignal): Promise<ProofExport[]> {
  const resp = await fetch(`${proofUrl()}/exports`, { signal });
  if (!resp.ok) return asError(resp);
  const body = (await resp.json()) as { exports: ProofExport[] };
  return body.exports;
}

/** Engine-loadable model names under the proof models dir (GET /models). */
export interface ProofModels {
  checkpoints: string[];
  loras: string[];
}

export async function listProofModels(signal?: AbortSignal): Promise<ProofModels> {
  const resp = await fetch(`${proofUrl()}/models`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** POST /run/stream request — mirrors the server's RunRequest. */
export interface RunEvalRequest {
  lora: string;
  base_checkpoint: string;
  lora_weight?: number;
  /** Export *name* (from listExports) to source the prompt + references from. */
  export?: string;
  /** Explicit prompt; overrides the export's captions. */
  prompt?: string;
  negative_prompt?: string;
  seeds?: number[];
  steps?: number;
  cfg?: number;
  sampler?: string;
  scheduler?: string;
  width?: number;
  height?: number;
  clip_skip?: number;
  run_id?: string;
}

/** One NDJSON frame from POST /run/stream. Generation frames follow the proof
 * ProgressEvent shape (start/progress/image/done), then `scoring`, then either
 * `complete` (with the stored report's summary) or `error`. */
export interface RunEvalProgress {
  type: "start" | "progress" | "image" | "done" | "scoring" | "complete" | "error";
  run_id: string;
  message?: string;
  seed?: number;
  image_id?: string;
  completed?: number;
  total?: number;
  n_images?: number;
  report?: ReportSummary;
}

/**
 * Trigger a generation+scoring run (POST /run/stream), streaming NDJSON
 * progress. Resolves with the stored report's summary from the `complete`
 * frame; a streamed `error` frame rejects.
 */
export async function runEvalStream(
  req: RunEvalRequest,
  onProgress: (p: RunEvalProgress) => void,
  signal?: AbortSignal,
): Promise<ReportSummary> {
  await requireCapability(proofHealth, allowsEval, READ_ONLY, signal);
  const resp = await fetch(`${proofUrl()}/run/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok) return asError(resp);

  let summary: ReportSummary | null = null;
  let streamedError: string | null = null;
  await readNdjson(resp, (obj) => {
    const frame = obj as unknown as RunEvalProgress;
    onProgress(frame);
    if (frame.type === "complete" && frame.report) summary = frame.report;
    else if (frame.type === "error") streamedError = frame.message ?? "generation failed";
  });

  if (streamedError) throw new Error(streamedError);
  if (!summary) throw new Error("Run stream ended without a result");
  return summary;
}
