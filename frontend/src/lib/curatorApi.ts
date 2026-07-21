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
 * An {@link ExportResult} normalized to the manifest-2.0 shape the app
 * consumes, so no downstream ever branches on curator version or rebuilds a
 * server path — that compat concern lives here, at the wire seam.
 */
export interface NormalizedExportResult extends Omit<ExportResult, "exported_paths"> {
  /**
   * rel_path -> exported_path (posix, relative to `dest`). **Partial**: a
   * missing key means "not in the handoff manifest", which is why the value
   * type is nullable — callers must handle the miss, and the type checker
   * holds them to it.
   *
   * A 2.0 curator's map is used as-is, including an empty one from a
   * zero-transfer export (detected by *presence*, so that stays empty rather
   * than being misread as 1.0). For 1.0 curators see {@link manifestGap}.
   */
  exported_paths: Record<string, string | undefined>;
  /**
   * Non-null when the seam could NOT establish a trustworthy rel -> exported
   * map, carrying a human-readable reason. Callers must skip the downstream
   * handoff and surface this instead of shipping fabricated locators.
   *
   * The one case today: a manifest-1.0 curator that flattened the export. It
   * never reported where files landed, and a flattened export de-collides
   * basenames into `stem-<hash>.ext`, which is unguessable from here.
   */
  manifestGap: string | null;
}

/**
 * Fold a raw curator ExportResult into {@link NormalizedExportResult}, so the
 * manifest-version rules stop leaking into components.
 */
export function normalizeExportResult(result: ExportResult, req: ExportRequest): NormalizedExportResult {
  // Detect legacy (manifest 1.0) by presence, not emptiness — a zero-transfer
  // 2.0 export legitimately sends an empty map and must not be misread as 1.0.
  if (result.exported_paths) {
    return { ...result, exported_paths: result.exported_paths, manifestGap: null };
  }
  if (!req.preserve_structure) {
    return {
      ...result,
      exported_paths: {},
      manifestGap:
        "this curator predates manifest 2.0 and did not report where a flattened export wrote each file",
    };
  }
  // Structure preserved, so the curator wrote each file at its own rel_path.
  // `selected_rel_paths` is optional in the published wire schema; treat an
  // absent one as an empty selection rather than throwing after the transfer.
  const selected = result.selected_rel_paths ?? [];
  return {
    ...result,
    exported_paths: Object.fromEntries(selected.map((rel) => [rel, rel])),
    manifestGap: null,
  };
}

/**
 * Absolute on-disk path of an exported file, or null when the caller should
 * keep the image's own `abs_path`. Only `move` relocates a file away from its
 * source, so only move resolves a new absolute — joined here, the seam that
 * owns the curator's `dest` layout, so no UI string-builds a server path.
 */
export function exportedAbsPath(result: NormalizedExportResult, relPath: string): string | null {
  if (result.mode !== "move") return null;
  const exported = result.exported_paths[relPath];
  return exported == null ? null : joinPath(result.dest, exported);
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
 * result already normalized to the manifest-2.0 shape the app consumes.
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
  return normalizeExportResult(result, req);
}

/** Build a /thumb URL for a scanned image (live mode only). */
export function thumbUrl(scanId: string, relPath: string): string {
  const params = new URLSearchParams({ scan_id: scanId, path: relPath });
  return `${curatorUrl()}/thumb?${params.toString()}`;
}
