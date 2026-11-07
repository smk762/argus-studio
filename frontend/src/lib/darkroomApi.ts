/**
 * Thin client for the argus-darkroom API (:8106): guarded image generation.
 * Wire shapes follow darkroom's record_version 1.0, ported from argus-safelight's
 * `types.ts`; when darkroom's record changes, change this file and
 * `lib/darkroom/fixture/`.
 *
 * The browser decides nothing here. Outcome, cell states, blur and the fired
 * rule all come from the record, and an image is fetched by record id only.
 */

import { asError } from "@/lib/apiError";
import { capabilityOf, healthMemo, requireCapability, type Capability } from "@/lib/capabilities";
import { darkroomUrl } from "@/lib/curatorEnv";
import { readSseFrames } from "@/lib/sse";

export type Outcome = "refused" | "passed" | "review" | "deleted" | "omitted" | "failed";
export const OUTCOMES: readonly Outcome[] = ["passed", "review", "deleted", "omitted", "refused", "failed"];

export type Mode = "sfw" | "nsfw";
export type ScanContext = "isolated" | "with_prompt";
export const SCAN_CONTEXTS: readonly ScanContext[] = ["isolated", "with_prompt"];

export type ThinkingMode = "fast" | "fast-slow" | "slow" | "cascade";
export const THINKING_MODES: readonly ThinkingMode[] = ["fast", "fast-slow", "slow", "cascade"];

export type CellState = "safe" | "flagged" | "illegal" | "unchecked";

/** SingGuard's verdict, as argus-cortex records it, plus the cascade's fast pass when the server reports one. */
export interface GuardResult {
  safe: boolean;
  /** The rules that fired, as the policy names them ("H. Non-Consensual Sexual Content"); empty when safe. */
  rules: string[];
  explanation: string | null;
  model: string | null;
  thinking: ThinkingMode | string | null;
  fast_verdict?: "safe" | "unsafe" | null;
  fast_rule?: string | null;
}

/** One policy × one context. The state is darkroom's classification; the browser does not redo it. */
export interface Cell {
  state: CellState;
  result: GuardResult | null;
  error: string | null;
}

export interface ScanPair {
  isolated: Cell;
  with_prompt: Cell;
}

export interface ModelRef {
  name: string;
  sha256: string;
}

export interface LoRARef extends ModelRef {
  weight: number;
  /** The words the request supplied for this LoRA, already in the final prompt. Older records have none. */
  trigger_words?: string[];
}

export interface SamplingParams {
  sampler: string;
  scheduler: string;
  steps: number;
  cfg: number;
  clip_skip: number;
  width: number;
  height: number;
}

export interface RecordRequest {
  mode: Mode;
  user_prompt: string;
  expanded_prompt: string | null;
  final_prompt: string;
  negative_prompt: string;
  expansion: { model: string; system_prompt_sha256: string } | null;
  /** Null on a record refused in pre-flight unless the request held a seed: none was drawn. */
  seed: number | null;
  /** This and the fields below are null on a record refused in pre-flight: nothing was resolved or hashed. `loras` is empty. */
  sampling: SamplingParams | null;
  checkpoint: ModelRef | null;
  vae: ModelRef | null;
  loras: LoRARef[];
  workflow_sha256: string | null;
  engine: string;
  engine_version: string | null;
}

export interface NudeNetBlock {
  /** Null when NudeNet did not answer (an NSFW record keeps the block with blur on). */
  exposed_score: number | null;
  labels: Record<string, number>;
  threshold: number;
  blur: boolean;
}

/** A tool's estimate from a face. Shown only as "MiVOLO estimate", never as an age. */
export interface AgeFace {
  age_estimate_years: number;
  bbox: [number, number, number, number];
}

export interface AgeBlock {
  source: "mivolo" | string;
  faces: AgeFace[];
  minor_exposed: boolean;
}

export interface GuardBlock {
  enforcing_policy: string;
  advisory_policies: string[];
  thinking: ThinkingMode | string;
  preflight: Record<string, Cell>;
  /** Empty for refused and failed records. */
  scans: Record<string, ScanPair>;
  nudenet: NudeNetBlock | null;
  age: AgeBlock | null;
}

export interface ImageBlock {
  sha256: string;
  phash: string;
  width: number;
  height: number;
  /** Only when passed or review and not removed by the user. The browser never uses it; images load by id. */
  path: string | null;
}

export interface GenerationRecord {
  record_version: string;
  id: string;
  created_at: string;
  darkroom_version: string;
  outcome: Outcome;
  /**
   * Refused, deleted and review records join every reason with ", ": `policy:letter` codes, and for a deletion
   * "minor-exposed" and "unchecked" ("adult-granular:A, minor-exposed"). Read those with `reasonParts`. Otherwise
   * "unchecked", "sfw-exposed", "sfw-unchecked", the generation error, or null.
   */
  outcome_reason: string | null;
  critical: boolean;
  removed_at: string | null;
  request: RecordRequest;
  guard: GuardBlock;
  /** Null for refused and failed records: nothing was rendered. */
  image: ImageBlock | null;
}

export interface Health {
  version: string;
  mock?: boolean;
  backends: { comfyui: boolean; ollama: boolean; singguard: boolean; nudenet: boolean; age: boolean };
  policies: string[];
  default_policy: string;
  thinking: ThinkingMode | string;
  nsfw_allowed: boolean;
  sfw_available: boolean;
  devmode: boolean;
  generating?: boolean;
  /** Real darkroom only. Whether Ollama expansion is configured, and why the age check cannot run (null when it can). */
  expansion_enabled?: boolean;
  age_unavailable?: string | null;
  workflow_loaded?: boolean;
  /** Real darkroom only. True when the server refuses every write, pre-flight included, with a 403. */
  read_only?: boolean;
}

export interface IllegalRule {
  code: string;
  name: string;
}

export interface PolicyInfo {
  name: string;
  mode: Mode;
  /** Null for `default`: SingGuard's own rules, nothing is sent. */
  text: string | null;
  summary: string;
  illegal_rules: IllegalRule[];
  /** False when this policy cannot enforce on this server (NSFW without --allow-nsfw, SFW without NudeNet). */
  enforceable: boolean;
}

export interface Policies {
  default: string;
  policies: PolicyInfo[];
}

/**
 * A model file under darkroom's models root. Darkroom sends the name only: hashing a checkpoint takes too long for
 * a list, and it cannot know a LoRA's trigger words, which each request supplies. A server that does know either
 * (the fixture mock) may send them, and the form uses them as suggestions.
 */
export interface ModelOption {
  name: string;
  sha256?: string;
  trigger_words?: string[];
}

export interface Models {
  /** The one a form starts on, resolved by darkroom. Null when its setting matches nothing. */
  default_checkpoint: string | null;
  checkpoints: ModelOption[];
  loras: ModelOption[];
  vaes: ModelOption[];
  samplers: string[];
  schedulers: string[];
}

export interface RecordPage {
  records: GenerationRecord[];
  total: number;
  page: number;
  page_size: number;
}

export interface LoRAChoice {
  name: string;
  weight: number;
  /** Appended to the final prompt by darkroom, after the expansion. */
  trigger_words: string[];
}

/** What `POST /preflight` and `POST /generate/stream` take. */
export interface GenerateRequest {
  user_prompt: string;
  negative_prompt: string;
  expand: boolean;
  enforcing_policy: string;
  advisory_policies: string[];
  thinking: ThinkingMode;
  checkpoint: string;
  loras: LoRAChoice[];
  seed: number | null;
  sampling: SamplingParams;
  nsfw_threshold: number;
}

export interface PreflightRefusal {
  policy: string;
  reason: string;
  rule: string | null;
  explanation: string | null;
}

export interface PreflightWarning {
  policy: string;
  rule: string;
  explanation: string | null;
}

export interface Preflight {
  /** False from `POST /preflight`, which never expands: an expansion differs per run. Absent on the stream's `preflight` event, which judged the real one. */
  expansion_applied?: boolean;
  mode: Mode;
  enforcing_policy: string;
  advisory_policies: string[];
  thinking: ThinkingMode | string;
  user_prompt: string;
  expanded_prompt: string | null;
  final_prompt: string;
  negative_prompt: string;
  framed_text: string;
  outcome: "ok" | "warning" | "refused";
  refusal: PreflightRefusal | null;
  warnings: PreflightWarning[];
  results: Record<string, Cell>;
}

export interface ProgressEvent {
  step: number;
  total: number;
}

export interface ScanEvent {
  policy: string;
  context: ScanContext;
  cell: Cell;
}

export const DARKROOM_READ_ONLY_REASON = "This darkroom is read-only (ARGUS_DARKROOM_READ_ONLY). Records and images stay readable.";

/**
 * Whether darkroom accepts writes. `read_only` refuses `POST /preflight` too, even
 * though a pre-flight generates nothing, so one capability covers every write.
 *
 * Legacy `true`, as for proof: a server that omits the field predates it and
 * did not refuse.
 */
export function allowsDarkroomWrite(health: Health | null): Capability {
  return capabilityOf(health, (h) => (typeof h.read_only === "boolean" ? !h.read_only : undefined), true);
}

async function fetchHealth(signal?: AbortSignal): Promise<Health> {
  const resp = await fetch(`${darkroomUrl()}/health`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** The posture every write gates on. */
const darkroomHealth = healthMemo(fetchHealth);

export async function getDarkroomHealth(signal?: AbortSignal): Promise<Health> {
  return darkroomHealth.remember(await fetchHealth(signal));
}

const requireWrite = (signal?: AbortSignal) =>
  requireCapability(darkroomHealth, allowsDarkroomWrite, DARKROOM_READ_ONLY_REASON, signal);

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const resp = await fetch(`${darkroomUrl()}${path}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export const getPolicies = (signal?: AbortSignal): Promise<Policies> => getJson("/policies", signal);
export const getModels = (signal?: AbortSignal): Promise<Models> => getJson("/models", signal);

export async function getRecord(id: string, signal?: AbortSignal): Promise<GenerationRecord> {
  const resp = await fetch(`${darkroomUrl()}/record/${encodeURIComponent(id)}`, { signal });
  if (resp.status === 404) throw new Error(`No record ${id}.`);
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export interface RecordQuery {
  outcome?: Outcome | null;
  mode?: Mode | null;
  page?: number;
  pageSize?: number;
}

export function getRecords(query: RecordQuery = {}, signal?: AbortSignal): Promise<RecordPage> {
  const params = new URLSearchParams();
  if (query.outcome) params.set("outcome", query.outcome);
  if (query.mode) params.set("mode", query.mode);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("page_size", String(query.pageSize));
  const suffix = params.size > 0 ? `?${params}` : "";
  return getJson(`/records${suffix}`, signal);
}

/** Images load by record id only. A deleted, omitted or refused record answers 404 here. */
/** The most `GET /records` serves at once. Darkroom answers 422 above it. */
export const MAX_PAGE_SIZE = 200;

export const imageUrl = (id: string): string => `${darkroomUrl()}/image/${encodeURIComponent(id)}`;
export const archiveUrl = (): string => `${darkroomUrl()}/archive`;

/** `POST /preflight`: the text check alone. It counts as a write, so `read_only` refuses it. */
export async function preflight(request: GenerateRequest, signal?: AbortSignal): Promise<Preflight> {
  await requireWrite(signal);
  const resp = await fetch(`${darkroomUrl()}/preflight`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Delete the user's own image file. The record stays, marked removed. */
export async function removeImage(id: string, signal?: AbortSignal): Promise<GenerationRecord> {
  await requireWrite(signal);
  const resp = await fetch(`${darkroomUrl()}/record/${encodeURIComponent(id)}`, { method: "DELETE", signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export interface GenerateHandlers {
  onPreflight: (preflight: Preflight) => void;
  onQueued: () => void;
  onProgress: (progress: ProgressEvent) => void;
  onScan: (scan: ScanEvent) => void;
}

/**
 * One generation over the SSE stream. Resolves with the record darkroom wrote,
 * whatever its outcome; a stream that ends without one is an error. Pre-flight
 * runs on the server first, whatever the page last checked.
 */
export async function generate(
  request: GenerateRequest,
  handlers: GenerateHandlers,
  signal?: AbortSignal,
): Promise<GenerationRecord> {
  await requireWrite(signal);
  const resp = await fetch(`${darkroomUrl()}/generate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!resp.ok) return asError(resp);
  if (!resp.body) throw new Error("Darkroom's response had no body.");
  let record: GenerationRecord | null = null;
  let failure: string | null = null;
  await readSseFrames(resp.body, ({ event, data }) => {
    if (event === "preflight") handlers.onPreflight(data as Preflight);
    else if (event === "queued") handlers.onQueued();
    else if (event === "progress") handlers.onProgress(data as ProgressEvent);
    else if (event === "scan") handlers.onScan(data as ScanEvent);
    else if (event === "complete") record = (data as { record: GenerationRecord }).record;
    else if (event === "error") failure = (data as { detail?: string }).detail || "Darkroom reported an error.";
  });
  if (record) return record;
  throw new Error(failure ?? "Darkroom ended the stream without a record.");
}
