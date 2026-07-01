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
