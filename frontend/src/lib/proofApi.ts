/**
 * Thin client for the argus-proof API (:8104) — post-training LoRA evaluation.
 * Shapes mirror `argus_proof.models` (schema/proof-wire.schema.json in
 * smk762/argus-proof): a scored EvalReport per generation run, with per-image
 * metric scores, structured reject reasons, HITL ratings, and a pass/fail
 * verdict. Follows the forgeApi.ts / galleryApi.ts pattern.
 */

import { PROOF_URL } from "@/lib/curatorEnv";
import { asError } from "@/lib/apiError";

// --- wire types (mirror argus_proof.models) --------------------------------

/** The automated scoring axes; each is [0,1] (higher = better) or null if the
 * scorer for it didn't run. */
export interface MetricScores {
  identity: number | null;
  clip_score: number | null;
  aesthetic: number | null;
  preference: number | null;
  safety: number | null;
}

/** Closed vocabulary of reject causes (argus_proof RejectReasonCode). */
export type RejectReasonCode =
  | "identity_mismatch"
  | "prompt_mismatch"
  | "low_quality"
  | "anatomy"
  | "artifact"
  | "duplicate"
  | "overfit"
  | "unsafe"
  | "other";

export interface RejectReason {
  code: RejectReasonCode;
  note?: string | null;
}

export interface ImageScores {
  image_id: string;
  seed: number;
  metrics: MetricScores;
  hitl_rating: number | null;
  hitl_rater: string | null;
  reject_reasons: RejectReason[];
  /** null = undecided (routed to HITL by the gate); true/false = pass/fail. */
  passed: boolean | null;
  duplicate_group: number | null;
}

export interface AggregateScores {
  n_images: number;
  n_passed: number;
  pass_rate: number;
  means: MetricScores;
  n_groups: number | null;
  n_needs_hitl: number;
  diversity: number | null;
}

export interface ScorerProvenance {
  name: string;
  metric: string;
  version: string | null;
  model: string | null;
}

export interface Verdict {
  passed: boolean;
  pending: boolean;
  reasons: string[];
}

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
  created_at: string | null;
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

/** Collect reviewer edits into the wire shape POST /report/{id}/hitl expects.
 * Machine-generated notes (the gate's ``auto: …`` explanations that seed the
 * picker on an auto-failed image) are dropped, so a reason the reviewer endorses
 * isn't recorded as if a human typed that note. */
export function editsToUpdates(edits: Map<string, HitlEdit>): HitlImageUpdate[] {
  return [...edits.entries()].map(([image_id, e]) => ({
    image_id,
    hitl_rating: e.hitl_rating,
    reject_reasons: e.reject_reasons.map((r) => (r.note?.startsWith("auto:") ? { code: r.code } : r)),
  }));
}

// --- fetchers --------------------------------------------------------------

export interface ProofHealth {
  status: string;
  service: string;
  version: string;
}

export async function getProofHealth(signal?: AbortSignal): Promise<ProofHealth> {
  const resp = await fetch(`${PROOF_URL}/health`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** List stored reports (GET /reports). */
export async function listReports(signal?: AbortSignal): Promise<ReportSummary[]> {
  const resp = await fetch(`${PROOF_URL}/reports`, { signal });
  if (!resp.ok) return asError(resp);
  const body = (await resp.json()) as { reports: ReportSummary[] };
  return body.reports;
}

/** Fetch one scored report (GET /report/{run_id}). */
export async function getReport(runId: string, signal?: AbortSignal): Promise<EvalReport> {
  const resp = await fetch(`${PROOF_URL}/report/${encodeURIComponent(runId)}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Apply a HITL review and get the recomputed report (POST /report/{id}/hitl). */
export async function submitHitl(runId: string, req: HitlRequest, signal?: AbortSignal): Promise<EvalReport> {
  const resp = await fetch(`${PROOF_URL}/report/${encodeURIComponent(runId)}/hitl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}
