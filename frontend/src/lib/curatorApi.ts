/** Thin client for the argus-curator API (:8101). */

import { curatorUrl } from "@/lib/curatorEnv";
import { capabilityOf, type Capability } from "@/lib/capabilities";
import type {
  CuratorConfig,
  Detectors,
  ExportRequest,
  ExportResult,
  FolderListing,
  ScanSummary,
} from "@/components/curator/types";
import { buildScanBody, MANIFEST_VERSION } from "@/components/curator/types";
import { asError } from "@/lib/apiError";
import { joinPath } from "@/lib/path";

/**
 * Major of a declared `manifest_version` (`"2.1"` -> 2), or `null` when it is
 * absent or not a plain numeric major.
 *
 * Strict on purpose, and deliberately the same rule argus-forge applies
 * (`models.manifest_major`, a bare `split(".", 1)[0]` matched against a set):
 * `Number.parseInt` prefix-parses, so `"02.1"`, `"2beta"` and `" 2.1"` would all
 * read as 2 here while forge refuses them, and the two services would disagree
 * about the same manifest. Only `/^\d+$/` counts as a declaration.
 *
 * `version` is typed `string | undefined` but arrives from an unvalidated
 * `resp.json()`, so a curator or proxy emitting a JSON *number* would make a
 * bare `.split` throw inside the seam — after the export has already run. Any
 * non-string is treated as "not declared" rather than crashing.
 */
export function manifestMajor(version: unknown): number | null {
  if (typeof version !== "string") return null;
  const head = version.split(".")[0];
  return /^\d+$/.test(head) ? Number(head) : null;
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

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const resp = await fetch(`${curatorUrl()}/health`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export async function getDetectors(signal?: AbortSignal): Promise<Detectors> {
  const resp = await fetch(`${curatorUrl()}/detectors`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export async function listFolders(path = "", signal?: AbortSignal): Promise<FolderListing> {
  const params = new URLSearchParams(path ? { path } : {});
  const resp = await fetch(`${curatorUrl()}/folders?${params.toString()}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export async function scanFolder(folder: string, cfg: CuratorConfig): Promise<ScanSummary> {
  const resp = await fetch(`${curatorUrl()}/scan/folder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildScanBody(folder, cfg)),
  });
  if (!resp.ok) return asError(resp);
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
 * Drive one of the curator's SSE endpoints to completion: dispatch every
 * `progress` frame to `onProgress` and resolve with the `complete` payload.
 * `label` names the operation in error messages ("Scan", "Export").
 *
 * Uses fetch + ReadableStream rather than EventSource so callers can POST a
 * request body.
 */
async function readSseStream<TProgress, TComplete>(
  body: ReadableStream<Uint8Array>,
  onProgress: (p: TProgress) => void,
  label: string,
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
    else if (event === "complete") return payload as TComplete;
    else if (event === "error") throw new Error(payload?.detail ?? `${label} failed`);
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

export type ScanPhase = "collecting" | "scoring" | "faces" | "clustering";

export interface ScanProgress {
  phase: ScanPhase;
  done: number;
  total: number;
}

/** Stream a scan over SSE (POST /scan/folder/stream), resolving with the final ScanSummary. */
export async function scanFolderStream(
  folder: string,
  cfg: CuratorConfig,
  onProgress: (p: ScanProgress) => void,
  signal?: AbortSignal,
): Promise<ScanSummary> {
  const resp = await fetch(`${curatorUrl()}/scan/folder/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildScanBody(folder, cfg)),
    signal,
  });
  if (!resp.ok || !resp.body) return asError(resp);
  return readSseStream<ScanProgress, ScanSummary>(resp.body, onProgress, "Scan");
}

export interface ExportProgress {
  phase: "transferring";
  done: number;
  total: number;
}

/**
 * Stream an export over SSE (POST /export/stream), resolving with the final
 * result normalized so the app never branches on the curator's manifest version.
 */
export async function exportSelectionStream(
  req: ExportRequest,
  onProgress: (p: ExportProgress) => void,
  signal?: AbortSignal,
): Promise<NormalizedExportResult> {
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
