/** Thin client for the argus-lens API (:8100) batch/folder endpoints. */

import type { FolderListing } from "@/components/curator/types";
import type { BatchCaptionResult, CaptionFolderRequest } from "@/types";

const LENS_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

async function asError(resp: Response): Promise<never> {
  const detail = await resp.json().catch(() => null);
  throw new Error(detail?.detail ?? `Server error: ${resp.status}`);
}

/** Browse folders under the lens --source-root (GET /folders). */
export async function listLensFolders(path = "", signal?: AbortSignal): Promise<FolderListing> {
  const params = new URLSearchParams(path ? { path } : {});
  const resp = await fetch(`${LENS_URL}/folders?${params.toString()}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Batch-caption every image in a server-side folder (POST /caption/folder). */
export async function captionFolder(req: CaptionFolderRequest): Promise<BatchCaptionResult> {
  const resp = await fetch(`${LENS_URL}/caption/folder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Batch-caption an argus-curator JSONL manifest (POST /caption/manifest). */
export async function captionManifest(
  file: File,
  opts?: { trigger_word?: string; write_sidecar?: boolean },
): Promise<BatchCaptionResult> {
  const fd = new FormData();
  fd.append("manifest", file);
  if (opts?.trigger_word) fd.append("trigger_word", opts.trigger_word);
  fd.append("write_sidecar", String(opts?.write_sidecar ?? true));
  const resp = await fetch(`${LENS_URL}/caption/manifest`, { method: "POST", body: fd });
  if (!resp.ok) return asError(resp);
  return resp.json();
}
