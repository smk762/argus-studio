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
import { buildScanBody } from "@/components/curator/types";
import { asError } from "@/lib/apiError";
import { joinPath } from "@/lib/path";

/**
 * The manifest major this app understands. The curator declares its version on
 * every {@link ExportResult}; anything outside this major is refused via
 * {@link NormalizedExportResult.manifestGap} rather than mishandled. Within the
 * major, fields are only ever added, so a newer minor stays readable.
 */
export const SUPPORTED_MANIFEST_MAJOR = 2;

/**
 * Major of a declared `manifest_version` (`"2.1"` -> 2), or `null` when it is
 * absent or unparseable. A manifest-1.0 curator never sent the field at all, so
 * an absent version reads as unsupported — which is the correct answer.
 */
function manifestMajor(version: string | undefined): number | null {
  if (!version) return null;
  const major = Number.parseInt(version.split(".")[0], 10);
  return Number.isInteger(major) ? major : null;
}

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
 * manifest-version rules stop leaking into components. Refuses an unknown major
 * outright — including a pre-2.0 curator, which declared no version.
 */
export function normalizeExportResult(result: ExportResult): NormalizedExportResult {
  const major = manifestMajor(result.manifest_version);
  if (major !== SUPPORTED_MANIFEST_MAJOR) {
    const speaks = result.manifest_version ?? "a pre-2.0 manifest";
    return {
      ...result,
      exported_paths: {},
      exported_abs_paths: {},
      manifestGap:
        `this curator speaks manifest ${speaks}, but this app handles ${SUPPORTED_MANIFEST_MAJOR}.x — ` +
        "upgrade the curator, or the studio, so the two agree",
    };
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
 * the relative locator, mirroring the curator's own resolution for the rare
 * 2.0-minor server that reported rel paths but not absolute ones.
 */
export function exportedAbsPath(result: NormalizedExportResult, relPath: string): string | null {
  const abs = result.exported_abs_paths[relPath];
  if (abs != null) return abs;
  const rel = result.exported_paths[relPath];
  return rel == null ? null : joinPath(result.dest, rel);
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
