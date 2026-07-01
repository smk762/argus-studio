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

async function asError(resp: Response): Promise<never> {
  const detail = await resp.json().catch(() => null);
  throw new Error(detail?.detail ?? `Server error: ${resp.status}`);
}

export interface Health {
  status: string;
  service: string;
  version: string;
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

export async function exportSelection(req: ExportRequest): Promise<ExportResult> {
  const resp = await fetch(`${CURATOR_URL}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Build a /thumb URL for a scanned image (live mode only). */
export function thumbUrl(scanId: string, relPath: string): string {
  const params = new URLSearchParams({ scan_id: scanId, path: relPath });
  return `${CURATOR_URL}/thumb?${params.toString()}`;
}
