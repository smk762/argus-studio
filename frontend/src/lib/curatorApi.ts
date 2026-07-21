/** Thin client for the argus-curator API (:8101). */

import { CURATOR_URL } from "@/lib/curatorEnv";
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
export interface NormalizedExportResult extends ExportResult {
  /**
   * rel_path -> exported_path (posix, relative to `dest`), for every file the
   * handoff manifest should carry. Always present: manifest-1.0 curators omit
   * `exported_paths`, so we synthesize an identity map over `selected_rel_paths`
   * (the legacy "whole selection" fallback). A 2.0 curator's map is used as-is —
   * including an empty one from a zero-transfer export, which must stay empty.
   */
  exported_paths: Record<string, string>;
  /**
   * rel_path -> absolute on-disk path of the transferred file, but ONLY for
   * modes that relocate it away from its source (move), where the source no
   * longer exists. Joined here — the seam that owns the curator's dest layout —
   * so no UI string-builds a server path. Other modes leave no entry: the
   * original source stays authoritative and the caller keeps the image's own
   * abs_path.
   */
  exported_abs_paths: Record<string, string>;
}

/**
 * Fold a raw curator ExportResult into {@link NormalizedExportResult}: fill in
 * `exported_paths` for legacy curators and resolve move-mode absolute paths, so
 * the manifest-version and path-layout rules stop leaking into components.
 */
export function normalizeExportResult(result: ExportResult): NormalizedExportResult {
  // Detect legacy (manifest 1.0) by presence, not emptiness — a zero-transfer
  // 2.0 export legitimately sends an empty map and must not be misread as 1.0.
  const exported_paths =
    result.exported_paths ?? Object.fromEntries(result.selected_rel_paths.map((rel) => [rel, rel]));
  // Only move relocates files; resolve those absolutes from `dest`. Copy/symlink
  // keep the source in place, so they get no entry (source stays authoritative).
  const exported_abs_paths =
    result.mode === "move"
      ? Object.fromEntries(Object.entries(exported_paths).map(([rel, ep]) => [rel, joinPath(result.dest, ep)]))
      : {};
  return { ...result, exported_paths, exported_abs_paths };
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

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const resp = await fetch(`${CURATOR_URL}/health`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export async function getDetectors(signal?: AbortSignal): Promise<Detectors> {
  const resp = await fetch(`${CURATOR_URL}/detectors`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export async function listFolders(path = "", signal?: AbortSignal): Promise<FolderListing> {
  const params = new URLSearchParams(path ? { path } : {});
  const resp = await fetch(`${CURATOR_URL}/folders?${params.toString()}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export async function scanFolder(folder: string, cfg: CuratorConfig): Promise<ScanSummary> {
  const resp = await fetch(`${CURATOR_URL}/scan/folder`, {
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
  const resp = await fetch(`${CURATOR_URL}/upload`, { method: "POST", body: fd });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Reload a persisted scan by id (GET /scan/{scan_id}). */
export async function getScan(scanId: string, limit = 10000, signal?: AbortSignal): Promise<ScanSummary> {
  const params = new URLSearchParams({ limit: String(limit) });
  const resp = await fetch(`${CURATOR_URL}/scan/${encodeURIComponent(scanId)}?${params.toString()}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export type ScanPhase = "collecting" | "scoring" | "faces" | "clustering";

export interface ScanProgress {
  phase: ScanPhase;
  done: number;
  total: number;
}

/**
 * Stream a scan over SSE (POST /scan/folder/stream), invoking `onProgress` for
 * each progress frame and resolving with the final ScanSummary. Uses fetch +
 * ReadableStream (not EventSource) so we can POST the scan config body.
 */
export async function scanFolderStream(
  folder: string,
  cfg: CuratorConfig,
  onProgress: (p: ScanProgress) => void,
  signal?: AbortSignal,
): Promise<ScanSummary> {
  const resp = await fetch(`${CURATOR_URL}/scan/folder/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildScanBody(folder, cfg)),
    signal,
  });
  if (!resp.ok || !resp.body) return asError(resp);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let summary: ScanSummary | null = null;

  const handleFrame = (frame: string) => {
    let event = "message";
    let data = "";
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;
    const payload = JSON.parse(data);
    if (event === "progress") onProgress(payload as ScanProgress);
    else if (event === "complete") summary = payload as ScanSummary;
    else if (event === "error") throw new Error(payload?.detail ?? "Scan failed");
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are separated by a blank line; keep the trailing partial.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      if (frame.trim()) handleFrame(frame);
    }
  }
  if (buffer.trim()) handleFrame(buffer);

  if (!summary) throw new Error("Scan stream ended without a result");
  return summary;
}

export async function exportSelection(req: ExportRequest): Promise<NormalizedExportResult> {
  const resp = await fetch(`${CURATOR_URL}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!resp.ok) return asError(resp);
  return normalizeExportResult(await resp.json());
}

export interface ExportProgress {
  phase: "transferring";
  done: number;
  total: number;
}

/**
 * Stream an export over SSE (POST /export/stream), invoking `onProgress` for
 * each file-transfer frame and resolving with the final ExportResult.
 */
export async function exportSelectionStream(
  req: ExportRequest,
  onProgress: (p: ExportProgress) => void,
  signal?: AbortSignal,
): Promise<NormalizedExportResult> {
  const resp = await fetch(`${CURATOR_URL}/export/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok || !resp.body) return asError(resp);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ExportResult | null = null;

  const handleFrame = (frame: string) => {
    let event = "message";
    let data = "";
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;
    const payload = JSON.parse(data);
    if (event === "progress") onProgress(payload as ExportProgress);
    else if (event === "complete") result = payload as ExportResult;
    else if (event === "error") throw new Error(payload?.detail ?? "Export failed");
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      if (frame.trim()) handleFrame(frame);
    }
  }
  if (buffer.trim()) handleFrame(buffer);

  if (!result) throw new Error("Export stream ended without a result");
  return normalizeExportResult(result);
}

/** Build a /thumb URL for a scanned image (live mode only). */
export function thumbUrl(scanId: string, relPath: string): string {
  const params = new URLSearchParams({ scan_id: scanId, path: relPath });
  return `${CURATOR_URL}/thumb?${params.toString()}`;
}
