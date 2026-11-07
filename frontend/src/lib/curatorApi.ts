/** Thin client for the argus-curator API (:8101). */

import { curatorUrl } from "@/lib/curatorEnv";
import {
  capabilityOf,
  CapabilityRefused,
  healthMemo,
  permits,
  requireCapability,
  type Capability,
} from "@/lib/capabilities";
import type {
  CuratorConfig,
  Detectors,
  ExportRequest,
  ExportResult,
  FolderListing,
  GuardPolicyInfo,
  ImageResult,
  ScanSummary,
  SelectRequest,
  SelectResult,
} from "@/components/curator/types";
import { buildScanBody, MANIFEST_VERSION, prefilterOn } from "@/components/curator/types";
import { asError } from "@/lib/apiError";
import { readPolicyCatalog } from "@/lib/curatorGuard";
import { isMinorExposed } from "@/lib/curatorSafety";
import { deleteBatches, type DeleteOutcome } from "@/lib/scanDelete";
import type { ScanChunk } from "@/lib/scanChunks";
import { joinPath } from "@/lib/path";

/**
 * Major of a declared `manifest_version` (`"2.1"` -> 2), or `null` when it is
 * absent or not a plain numeric major.
 *
 * Strict on purpose, and deliberately the same rule argus-forge applies
 * (`models.manifest_major`, a bare `split(".", 1)[0]` matched against a set):
 * `Number.parseInt` prefix-parses, so `"02.1"`, `"2beta"` and `" 2.1"` would all
 * read as 2 here while forge refuses them, and the two services would disagree
 * about the same manifest. Only a canonical decimal major counts as a
 * declaration — no leading zeros, since forge compares the *string* against
 * `("1", "2")` and so refuses `"02"`.
 *
 * `version` is typed `string | undefined` but arrives from an unvalidated
 * `resp.json()`, so a curator or proxy emitting a JSON *number* would make a
 * bare `.split` throw inside the seam — after the export has already run. Any
 * non-string is treated as "not declared" rather than crashing.
 */
export function manifestMajor(version: unknown): number | null {
  if (typeof version !== "string") return null;
  const head = version.split(".")[0];
  return /^(0|[1-9]\d*)$/.test(head) ? Number(head) : null;
}

/**
 * The manifest major this app understands, derived from the version it stamps so
 * the two cannot drift: bumping {@link MANIFEST_VERSION} for a new major is the
 * single edit. Within a major, fields are only ever added, so a newer minor
 * stays readable.
 */
export const SUPPORTED_MANIFEST_MAJOR = manifestMajor(MANIFEST_VERSION) ?? 2;

/**
 * An {@link ExportResult} the app can consume without knowing the curator's
 * version — that compat concern lives here, at the wire seam. Since curator
 * manifest 2.1 the server publishes both the rel and absolute locators for
 * every transferred file, so this no longer reconstructs anything; it just
 * refuses a manifest major it doesn't understand.
 */
export interface NormalizedExportResult extends Omit<ExportResult, "exported_paths" | "exported_abs_paths"> {
  /**
   * rel_path -> path written under `dest` (posix, relative to it). **Partial**:
   * a missing key means the file was not transferred (source vanished or the
   * copy failed), which is why the value is nullable — callers must handle the
   * miss and the type checker holds them to it. Empty from a zero-transfer
   * export, which is a valid state, not a gap.
   */
  exported_paths: Record<string, string | undefined>;
  /** The same mapping, absolute — see {@link exportedAbsPath}. Same partiality. */
  exported_abs_paths: Record<string, string | undefined>;
  /**
   * Non-null when the curator's declared manifest major is not
   * {@link SUPPORTED_MANIFEST_MAJOR}, carrying a human-readable reason. Callers
   * must skip the downstream handoff and surface this rather than ship locators
   * from a contract they can't interpret.
   */
  manifestGap: string | null;
}

/**
 * Fold a raw curator ExportResult into {@link NormalizedExportResult}, so the
 * manifest-version rules stop leaking into components.
 *
 * Version first, presence second — both are needed, because `manifest_version`
 * arrived on `ExportResult` *later than* the 2.0 contract it describes. A
 * manifest-2.0 curator declares the version on each manifest row but not on the
 * result, while still publishing the normative `exported_paths` map; branching
 * on the declared major alone would refuse that server as "pre-2.0" even though
 * it supplies exactly what this seam consumes. So an undeclared version falls
 * back to the presence of `exported_paths`, which is the one thing that actually
 * distinguishes a 2.x result from a 1.x one.
 */
export function normalizeExportResult(result: ExportResult): NormalizedExportResult {
  const major = manifestMajor(result.manifest_version);
  const refuse = (reason: string): NormalizedExportResult => ({
    ...result,
    exported_paths: {},
    exported_abs_paths: {},
    manifestGap: reason,
  });

  if (major !== null && major !== SUPPORTED_MANIFEST_MAJOR) {
    return refuse(
      `this curator writes manifest ${result.manifest_version}, but this app reads ` +
        `${SUPPORTED_MANIFEST_MAJOR}.x — upgrade the curator, or the studio, so the two agree`,
    );
  }
  if (major === null && result.exported_paths === undefined) {
    return refuse(
      "this curator predates manifest 2.0: it did not report where the export wrote each file, " +
        "and those destinations cannot be reconstructed from here — upgrade the curator",
    );
  }
  return {
    ...result,
    exported_paths: result.exported_paths ?? {},
    exported_abs_paths: result.exported_abs_paths ?? {},
    manifestGap: null,
  };
}

/**
 * Absolute on-disk location of a transferred file, or null when it was not in
 * the handoff manifest. Mode-agnostic: the curator reports where every file
 * landed regardless of copy/symlink/move, so the caller — not this accessor —
 * decides whether it wants that location or the image's own source `abs_path`.
 *
 * Prefers the server's `exported_abs_paths`; falls back to joining `dest` onto
 * the relative locator, mirroring the curator's own resolution for a manifest-2.0
 * server, which reports rel paths but not absolute ones. `result.dest` is the
 * curator's own resolved root (it rewrites the requested dest under its export
 * root before transferring, and reports the resolved value), so the join lands
 * where the server actually wrote.
 *
 * Empty strings are treated as absent, not as answers — the curator's own writer
 * does the same (`abs_paths.get(rel) or ...`). Accepting `""` here would stamp an
 * empty locator into the row, and argus-lens rejects a row whose `abs_path` is
 * falsy, so every image would fail after the sources were already relocated.
 */
export function exportedAbsPath(result: NormalizedExportResult, relPath: string): string | null {
  const abs = result.exported_abs_paths[relPath];
  if (abs) return abs;
  const rel = exportedRelPath(result, relPath);
  return rel === null ? null : joinPath(result.dest, rel);
}

/**
 * The relative locator for a transferred file, or null when it was not in the
 * handoff manifest. An empty value counts as absent for the same reason as in
 * {@link exportedAbsPath} — a `""` rel path would join to the export directory
 * itself and present a directory as the file's location.
 */
export function exportedRelPath(result: NormalizedExportResult, relPath: string): string | null {
  return result.exported_paths[relPath] || null;
}

export interface Health {
  status: string;
  service: string;
  version: string;
  /**
   * Absolute export root the server contains `/export` destinations under, or
   * `null` when unconfigured (in which case every live export 400s). Older
   * servers omit the field. Added in the curator path-containment change.
   */
  export_root?: string | null;
  /** Whether the server permits destructive `mode: "move"` exports. */
  allow_move?: boolean;
  /**
   * The manifest contract version this curator writes (e.g. `"2.1"`), declared
   * separately from `version` since the two move independently. Absent on a
   * pre-2.0 curator. Lets a client refuse an unsupported major up front rather
   * than at export time — see {@link SUPPORTED_MANIFEST_MAJOR}.
   */
  manifest_version?: string;
  /** POST /scan/{id}/cancel and POST /scans/purge exist (curator 0.6 and later). */
  scan_control?: boolean;
  /** DELETE /scan/{id} exists (curator 0.12 and later). */
  scan_delete?: boolean;
  /** POST /scan/{id}/delete takes any scanned image, not only a minor-exposed one (curator 0.12 and later). */
  delete_any?: boolean;
  /** `GET /guard/policies` exists (curator 0.8 and later). */
  guard_policy_text?: boolean;
  /** `FaceConfig.set_age` exists (curator 0.7 and later). */
  set_age?: boolean;
  /** `ScanRequest.prefilter` exists (curator 0.12 and later). */
  prefilter?: boolean;
  /** `ScanRequest.crops` exists (curator 0.14 and later). */
  crops?: boolean;
  /** `CropConfig.detect` exists. The detector's URL is `/detectors.watermark`. */
  watermark_detect?: boolean;
  /** `carry_sidecars` and `run_stats` on an export (curator 0.13 and later). */
  export_sidecars?: boolean;
}

/**
 * Whether this server permits destructive `mode: "move"` exports.
 *
 * Legacy `true`: servers predating `--allow-move` / `CURATOR_ALLOW_MOVE` always
 * permitted move. The *caller* is what fails safe here — {@link permits} treats
 * the still-loading `null` as "no", so an unreachable `/health` can't leave a
 * destructive move armed.
 */
export function allowsMove(health: Health | null): Capability {
  return capabilityOf(health, (h) => h.allow_move, true);
}

/**
 * Whether this server can stop a running scan and purge its cache.
 *
 * Legacy `false`: both endpoints arrived with curator 0.6, so a server that
 * omits `scan_control` cannot do either. A missing `/health` stays unknown.
 */
export function allowsScanControl(health: Health | null): Capability {
  return capabilityOf(health, (h) => h.scan_control, false);
}

/**
 * Whether this server can delete one cached scan.
 *
 * Legacy `false`: `DELETE /scan/{id}` arrived with curator 0.12. A server that
 * omits `scan_delete` cannot, and a missing `/health` stays unknown.
 */
export function allowsScanDelete(health: Health | null): Capability {
  return capabilityOf(health, (h) => h.scan_delete, false);
}

/**
 * Whether this server deletes any scanned image from disk.
 *
 * Legacy `false`: `--allow-delete` arrived with curator 0.12, and it stays off
 * unless a deployer turns it on.
 */
export function allowsDeleteAny(health: Health | null): Capability {
  return capabilityOf(health, (h) => h.delete_any, false);
}

/**
 * Whether this server deletes a minor-exposed image. It always does, whatever
 * `delete_any` says, so the field being present is the whole check.
 *
 * Legacy `false`: an older server does not say, and this deletes files.
 */
export function allowsMinorExposedDelete(health: Health | null): Capability {
  return capabilityOf(health, (h) => (typeof h.delete_any === "boolean" ? true : undefined), false);
}

/** Whether this server serves its policy wording. Legacy `false`: an older curator has no such route. */
export function allowsGuardPolicyText(health: Health | null): Capability {
  return capabilityOf(health, (h) => h.guard_policy_text, false);
}

/** Whether frames with no face can take the set's age. Legacy `false`: an older curator ignores the field. */
export function allowsSetAge(health: Health | null): Capability {
  return capabilityOf(health, (h) => h.set_age, false);
}

/**
 * Whether this server drops images before the late phases. Legacy `false`: an
 * older curator ignores the block and runs every check on every image.
 */
export function allowsPrefilter(health: Health | null): Capability {
  return capabilityOf(health, (h) => h.prefilter, false);
}

/** Whether this server crops. Legacy `false`: an older curator would scan the frames uncropped. */
export function allowsCrops(health: Health | null): Capability {
  return capabilityOf(health, (h) => h.crops, false);
}

/** Whether this server looks for watermarks. Legacy `false`, like {@link allowsCrops}. */
export function allowsWatermarkDetect(health: Health | null): Capability {
  return capabilityOf(health, (h) => h.watermark_detect, false);
}

/**
 * Whether this server carries sidecars and writes run stats. Legacy `false`:
 * an older curator ignores both, and under move the captions stay behind.
 */
export function allowsExportSidecars(health: Health | null): Capability {
  return capabilityOf(health, (h) => h.export_sidecars, false);
}

/**
 * Whether this server has an export root configured, i.e. whether a live export
 * can succeed at all.
 *
 * Same tri-state as {@link allowsMove}, and for the same reason: reading
 * `health?.export_root === null` directly fails **open** while `/health` is in
 * flight (`undefined === null` is false), so the export button stayed armed on a
 * server that 400s every export. `null` (unknown) now disables it like any other
 * unresolved capability. A missing field is an older server that predates the
 * export root and is fine, so absence reads as permitted.
 */
export function allowsExport(health: Health | null): Capability {
  return capabilityOf(health, (h) => h.export_root !== null, true);
}

/**
 * Whether this curator writes a manifest major this app can read.
 *
 * The point of asking `/health` is timing: {@link normalizeExportResult} can only
 * refuse *after* `POST /export/stream` has finished, by which point a
 * `mode: "move"` export has already deleted every source file — the compat gate
 * would sit below the destructive operation it guards. Checking the advertised
 * version up front lets the export be refused before anything moves.
 *
 * Legacy `true`: a curator that omits the field may still be a manifest-2.0
 * server (the field postdates that contract), and those export fine — refusing
 * them here would ground a working deployment. The post-export check in
 * {@link normalizeExportResult} still catches the genuinely unreadable ones.
 */
export function speaksSupportedManifest(health: Health | null): Capability {
  return capabilityOf(
    health,
    (h) => {
      const major = manifestMajor(h.manifest_version);
      return major === null ? undefined : major === SUPPORTED_MANIFEST_MAJOR;
    },
    true,
  );
}

async function fetchHealth(signal?: AbortSignal): Promise<Health> {
  const resp = await fetch(`${curatorUrl()}/health`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** The posture {@link exportSelectionStream} gates on. */
const curatorHealth = healthMemo(fetchHealth);

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  return curatorHealth.remember(await fetchHealth(signal));
}

export async function getDetectors(signal?: AbortSignal): Promise<Detectors> {
  const resp = await fetch(`${curatorUrl()}/detectors`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Every policy a scan can name, with its wording. Requests still pick one by name, never by text. */
export async function getGuardPolicies(signal?: AbortSignal): Promise<GuardPolicyInfo[]> {
  const resp = await fetch(`${curatorUrl()}/guard/policies`, { signal });
  if (!resp.ok) return asError(resp);
  return readPolicyCatalog(await resp.json());
}

export async function listFolders(path = "", signal?: AbortSignal): Promise<FolderListing> {
  const params = new URLSearchParams(path ? { path } : {});
  const resp = await fetch(`${curatorUrl()}/folders?${params.toString()}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export const SET_AGE_DENIED = "This curator cannot read a set's age (it predates curator 0.7).";
export const PREFILTER_DENIED = "This curator cannot drop images before the late checks (it predates the prefilter).";
export const CROPS_DENIED = "This curator cannot crop images (it predates crops).";
export const WATERMARK_DENIED = "This curator cannot look for watermarks (it predates watermark detection).";
export const EXPORT_SIDECARS_DENIED = "This curator cannot carry sidecars or write run stats (it predates curator 0.13).";
export const CROPPED_COPY_ONLY = "This scan cropped images, so it exports by copy only.";

/** A scan that names a check this server would silently skip is refused before it starts. */
async function requireScanCapabilities(cfg: CuratorConfig, signal?: AbortSignal): Promise<void> {
  if (cfg.faces.set_age) await requireCapability(curatorHealth, allowsSetAge, SET_AGE_DENIED, signal);
  if (prefilterOn(cfg.prefilter)) await requireCapability(curatorHealth, allowsPrefilter, PREFILTER_DENIED, signal);
  if (!cfg.crops.enabled) return;
  await requireCapability(curatorHealth, allowsCrops, CROPS_DENIED, signal);
  if (cfg.crops.detect) await requireCapability(curatorHealth, allowsWatermarkDetect, WATERMARK_DENIED, signal);
}

/**
 * Throw a refused scan's `detail`. `/detectors.watermark` only says the URL is
 * set, so a scan can pass every check here and still get the 503 for a detector
 * that is stopped or loading (curator 0.14.1). Say what to do about it.
 */
async function scanRefused(resp: Response): Promise<never> {
  try {
    return await asError(resp);
  } catch (err) {
    if (resp.status === 503 && err instanceof Error && /watermark detection/i.test(err.message)) {
      throw new Error(`${err.message}. Start the detector, or turn off Detect watermarks, and scan again.`);
    }
    throw err;
  }
}

export async function scanFolder(folder: string, cfg: CuratorConfig): Promise<ScanSummary> {
  await requireScanCapabilities(cfg);
  const resp = await fetch(`${curatorUrl()}/scan/folder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildScanBody(folder, cfg)),
  });
  if (!resp.ok) return scanRefused(resp);
  return resp.json();
}

export interface UploadResult {
  folder: string;
  saved: number;
  skipped: string[];
  errors: { name: string; detail: string }[];
}

/** Upload browser-picked images into a folder under the curator source root (POST /upload). */
export async function uploadImages(files: File[], folder: string): Promise<UploadResult> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  fd.append("folder", folder);
  const resp = await fetch(`${curatorUrl()}/upload`, { method: "POST", body: fd });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Reload a persisted scan by id (GET /scan/{scan_id}). */
export async function getScan(scanId: string, limit = 10000, signal?: AbortSignal): Promise<ScanSummary> {
  const params = new URLSearchParams({ limit: String(limit) });
  const resp = await fetch(`${curatorUrl()}/scan/${encodeURIComponent(scanId)}?${params.toString()}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/**
/**
 * The stream ended with `event: cancelled`: the scan was stopped by
 * `POST /scan/{id}/cancel` or `POST /scans/purge` (curator ≥ 0.6), possibly
 * from another window or client. A distinct type so callers can show it as a
 * stop rather than a failure.
 */
export class StreamCancelled extends Error {
  constructor(label: string) {
    super(`${label} was stopped before it finished (cancelled or purged on the curator, possibly from another window).`);
    this.name = "StreamCancelled";
  }
}

/** The message for an `event: error` frame; curator ≥ 0.10 adds `retry_after` (seconds) when the GPU lease timed out. */
function streamErrorMessage(payload: unknown, label: string): string {
  const p = (payload ?? {}) as { detail?: unknown; retry_after?: unknown };
  const detail = typeof p.detail === "string" && p.detail ? p.detail : `${label} failed`;
  return typeof p.retry_after === "number" && p.retry_after > 0 ? `${detail} (retry in ${p.retry_after}s)` : detail;
}

/**
 * Drive one of the curator's SSE endpoints to completion: dispatch every
 * `progress` frame to `onProgress` and resolve with the `complete` payload.
 * `label` names the operation in error messages ("Scan", "Export").
 *
 * `event: cancelled` throws {@link StreamCancelled}. `event: chunk` result
 * batches (curator ≥ 0.5) go to `onChunk` when a scan is listening; export
 * streams pass no listener and those frames stay ignored.
 *
 * Uses fetch + ReadableStream rather than EventSource so callers can POST a
 * request body. Exported for tests.
 */
export async function readSseStream<TProgress, TComplete, TChunk = unknown>(
  body: ReadableStream<Uint8Array>,
  onProgress: (p: TProgress) => void,
  label: string,
  onChunk?: (chunk: TChunk) => void,
): Promise<TComplete> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let complete: TComplete | null = null;

  // Returns the `complete` payload when this frame carried one. Kept as a
  // return value rather than a captured assignment so the narrowing below
  // sees it — TypeScript does not track writes made inside a closure.
  const handleFrame = (frame: string): TComplete | undefined => {
    let event = "message";
    let data = "";
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return undefined;
    const payload = JSON.parse(data);
    if (event === "progress") onProgress(payload as TProgress);
    else if (event === "chunk") onChunk?.(payload as TChunk);
    else if (event === "complete") return payload as TComplete;
    else if (event === "error") throw new Error(streamErrorMessage(payload, label));
    else if (event === "cancelled") throw new StreamCancelled(label);
    return undefined;
  };

  // An `event: error` frame (or a JSON.parse failure on a truncated tail) throws
  // out of handleFrame. Without this finally the reader keeps its lock and the
  // response body is never cancelled, so each failed export leaks a dangling
  // stream — a handful of retries exhaust the browser's per-host connection pool
  // and every later curator request hangs.
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE frames are separated by a blank line; keep the trailing partial.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        if (frame.trim()) complete = handleFrame(frame) ?? complete;
      }
    }
    if (buffer.trim()) complete = handleFrame(buffer) ?? complete;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }

  if (complete === null) throw new Error(`${label} stream ended without a result`);
  return complete;
}

/**
 * Scan phases, in the order curator 0.13 runs them. Which run depends on the
 * scan's checks and the server's detectors. The union stays open
 * (`string & {}`) because a newer curator may add phases; the UI must not go
 * blank on one it doesn't know.
 */
export const SCAN_PHASE_LABELS = {
  starting: "Starting scan",
  collecting: "Reading images from disk",
  scoring: "Scoring images",
  watermarks: "Finding watermarks",
  faces: "Detecting faces",
  erax: "Checking with EraX",
  nsfw: "Checking for nudity",
  identities: "Clustering identities",
  prefilter: "Applying prefilter",
  scenes: "Classifying scenes",
  garments: "Detecting garments",
  guard: "Running SingGuard",
  clustering: "Grouping near-duplicates",
} as const;

export type KnownScanPhase = keyof typeof SCAN_PHASE_LABELS;
export type ScanPhase = KnownScanPhase | (string & {});

/** A readable label for any phase, including ones newer than this client. */
export function scanPhaseLabel(phase: ScanPhase): string {
  if (Object.hasOwn(SCAN_PHASE_LABELS, phase)) return SCAN_PHASE_LABELS[phase as KnownScanPhase];
  const words = phase.replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Working";
}

/**
 * Whether a phase's done/total is a meaningful running count (a determinate
 * bar). Collecting, identities and near-duplicate clustering only emit start and
 * end, so they show as pending. An unknown phase gets a bar when it reports a total.
 */
export function isDeterminatePhase(phase: ScanPhase): boolean {
  return !["starting", "collecting", "identities", "prefilter", "clustering"].includes(phase);
}

export interface ScanProgress {
  phase: ScanPhase;
  done: number;
  total: number;
  /** Checks still running on the images streamed so far (curator ≥ 0.5.1). */
  pending_checks?: string[];
}

/** Stream a scan over SSE (POST /scan/folder/stream), resolving with the final ScanSummary. */
export async function scanFolderStream(
  folder: string,
  cfg: CuratorConfig,
  onProgress: (p: ScanProgress) => void,
  onChunk?: (chunk: ScanChunk) => void,
  signal?: AbortSignal,
): Promise<ScanSummary> {
  await requireScanCapabilities(cfg, signal);
  const resp = await fetch(`${curatorUrl()}/scan/folder/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildScanBody(folder, cfg)),
    signal,
  });
  if (!resp.ok || !resp.body) return scanRefused(resp);
  return readSseStream<ScanProgress, ScanSummary, ScanChunk>(resp.body, onProgress, "Scan", onChunk);
}

/** Ask the running scan to stop (POST /scan/{id}/cancel). A 404 means it already finished. */
export async function cancelScan(scanId: string, signal?: AbortSignal): Promise<void> {
  await requireCapability(
    curatorHealth,
    allowsScanControl,
    "This curator cannot stop a running scan (it predates scan control).",
    signal,
  );
  const resp = await fetch(`${curatorUrl()}/scan/${encodeURIComponent(scanId)}/cancel`, { method: "POST", signal });
  if (resp.status === 404) return;
  if (!resp.ok) return asError(resp);
}

export interface PurgeResult {
  cancelled: string | null;
  deleted: string[];
}

export interface CachedScan {
  scan_id: string;
  folder: string;
  total: number;
  updated_at: string;
}

export interface ActiveScan {
  scan_id: string;
  folder: string;
  phase: string;
  done: number;
  total: number;
  pending_checks?: string[];
  cancelling?: boolean;
}

export interface ScanList {
  active: ActiveScan | null;
  scans: CachedScan[];
}

/**
 * Scans the curator still holds (GET /scans, curator 0.5 and later).
 * `null` when this server has no such list, so the page can keep its own.
 */
export async function listScans(signal?: AbortSignal): Promise<ScanList | null> {
  const resp = await fetch(`${curatorUrl()}/scans`, { signal });
  if (resp.status === 404) return null;
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Remove one cached scan (DELETE /scan/{id}). Source images stay. The running scan is refused. */
export async function deleteCachedScan(scanId: string, signal?: AbortSignal): Promise<void> {
  await requireCapability(
    curatorHealth,
    allowsScanDelete,
    "This curator cannot delete a cached scan (it predates scan delete).",
    signal,
  );
  const resp = await fetch(`${curatorUrl()}/scan/${encodeURIComponent(scanId)}`, { method: "DELETE", signal });
  if (!resp.ok) return asError(resp);
}

export const IMAGE_DELETE_DENIED = "This curator cannot delete images (it predates image delete).";
export const DELETE_ANY_DENIED =
  "This curator only deletes under-18 exposed images. Start it with CURATOR_ALLOW_DELETE=1 to delete others.";

/**
 * Delete source files from a scan (POST /scan/{id}/delete). The rows leave the
 * cached scan too. A refusal throws; once requests have gone out the outcome
 * says how far they got, because earlier files are already gone by then.
 *
 * Without `delete_any` the server applies its own under-18 rule, which flags
 * fewer frames than {@link isMinorExposed} does, and one refused path refuses
 * its whole request. So those frames go one per request, and a 403 keeps only
 * that frame.
 */
export async function deleteScanImages(
  scanId: string,
  rows: readonly ImageResult[],
  signal?: AbortSignal,
): Promise<DeleteOutcome> {
  const outcome: DeleteOutcome = { deleted: [], refused: [], error: null };
  if (rows.length === 0) return outcome;
  const flaggedOnly = rows.every(isMinorExposed);
  await requireCapability(
    curatorHealth,
    flaggedOnly ? allowsMinorExposedDelete : allowsDeleteAny,
    flaggedOnly ? IMAGE_DELETE_DENIED : DELETE_ANY_DENIED,
    signal,
  );
  const paths = rows.map((row) => row.rel_path);
  const anyImage = permits(allowsDeleteAny(await curatorHealth.current(signal)));
  for (const batch of deleteBatches(paths, anyImage ? undefined : 1)) {
    try {
      const resp = await fetch(`${curatorUrl()}/scan/${encodeURIComponent(scanId)}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rel_paths: batch }),
        signal,
      });
      if (resp.status === 403 && !anyImage) {
        outcome.refused.push(...batch);
        continue;
      }
      if (!resp.ok) await asError(resp);
      outcome.deleted.push(...batch);
    } catch (err) {
      outcome.error = err instanceof Error ? err : new Error("Could not delete those images");
      break;
    }
  }
  return outcome;
}

/** Stop whatever is running and delete every cached scan (POST /scans/purge). */
export async function purgeScans(signal?: AbortSignal): Promise<PurgeResult> {
  await requireCapability(
    curatorHealth,
    allowsScanControl,
    "This curator cannot purge cached scans (it predates scan control).",
    signal,
  );
  const resp = await fetch(`${curatorUrl()}/scans/purge`, { method: "POST", signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export interface ExportProgress {
  phase: "transferring";
  done: number;
  total: number;
}

/**
 * What this filter would keep (POST /scan/{id}/select, curator 0.4). Writes
 * nothing and creates nothing, so it is a read that happens to take a body, and
 * no `/health` field covers it. It therefore has no capability gate.
 */
export async function previewKeepSet(scanId: string, body: SelectRequest, signal?: AbortSignal): Promise<SelectResult> {
  const resp = await fetch(`${curatorUrl()}/scan/${encodeURIComponent(scanId)}/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/**
 * Stream an export over SSE (POST /export/stream), resolving with the final
 * result normalized so the app never branches on the curator's manifest version.
 *
 * `scanCropped` is the row-level fact behind the curator's copy-only rule, which
 * this request alone cannot show. See `scanHasCrops`.
 */
export async function exportSelectionStream(
  req: ExportRequest,
  onProgress: (p: ExportProgress) => void,
  signal?: AbortSignal,
  scanCropped = false,
): Promise<NormalizedExportResult> {
  // Manifest first: it is the only check that must precede a move, since the
  // post-export refusal in normalizeExportResult lands after the sources are gone.
  await requireCapability(
    curatorHealth,
    speaksSupportedManifest,
    `This curator writes a manifest major this app can't read (it reads ${SUPPORTED_MANIFEST_MAJOR}.x); upgrade one side so they agree.`,
    signal,
  );
  await requireCapability(
    curatorHealth,
    allowsExport,
    "This curator has no export root configured, so it refuses every export (set ARGUS_CURATOR_EXPORT_ROOT).",
    signal,
  );
  if (req.mode === "move") {
    await requireCapability(
      curatorHealth,
      allowsMove,
      "This curator refuses destructive move exports (start it with --allow-move / CURATOR_ALLOW_MOVE=1).",
      signal,
    );
  }
  if (req.carry_sidecars || req.run_stats != null) {
    await requireCapability(curatorHealth, allowsExportSidecars, EXPORT_SIDECARS_DENIED, signal);
  }
  if (scanCropped && req.mode !== "copy") throw new CapabilityRefused(CROPPED_COPY_ONLY, true);
  const resp = await fetch(`${curatorUrl()}/export/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok || !resp.body) return asError(resp);
  const result = await readSseStream<ExportProgress, ExportResult>(resp.body, onProgress, "Export");
  return normalizeExportResult(result);
}

/** Build a /thumb URL for a scanned image (live mode only). */
export function thumbUrl(scanId: string, relPath: string): string {
  const params = new URLSearchParams({ scan_id: scanId, path: relPath });
  return `${curatorUrl()}/thumb?${params.toString()}`;
}
