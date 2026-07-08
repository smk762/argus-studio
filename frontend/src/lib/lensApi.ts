/** Thin client for the argus-lens API (:8100) batch/folder endpoints. */

import type { FolderListing } from "@/components/curator/types";
import type { BatchCaptionResult, CaptionFolderRequest, CaptionResult } from "@/types";
import { asError } from "@/lib/apiError";

const LENS_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

/**
 * Server-side captioning profiles (GET /profiles). Only the hybrid tag↔prose
 * balance fields are typed here; the endpoint returns additional keys we ignore.
 */
export interface LensProfiles {
  /** Named balance stops → prose_bias value, e.g. {tags:0.2, balanced:0.5, prose:0.85}. */
  hybrid_presets: Record<string, number>;
  /** The preset applied when neither hybrid_preset nor prose_bias is sent. */
  default_hybrid_preset: string;
}

/** Fetch the lens captioning profiles, including hybrid tag↔prose presets (GET /profiles). */
export async function getLensProfiles(signal?: AbortSignal): Promise<LensProfiles> {
  const resp = await fetch(`${LENS_URL}/profiles`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Optional tag↔prose balance controls accepted by every caption endpoint. */
export interface HybridBalanceParams {
  /** Named balance stop; ignored by the server when prose_bias is also sent. */
  hybrid_preset?: string;
  /** Continuous 0.0 (pure tags) .. 1.0 (full prose); overrides hybrid_preset. */
  prose_bias?: number;
}

/** Append hybrid balance fields to a multipart body only when set. */
function appendHybrid(fd: FormData, opts?: HybridBalanceParams): void {
  if (opts?.hybrid_preset) fd.append("hybrid_preset", opts.hybrid_preset);
  if (opts?.prose_bias != null) fd.append("prose_bias", String(opts.prose_bias));
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
  opts?: { trigger_word?: string; write_sidecar?: boolean; write_xmp?: boolean } & HybridBalanceParams,
): Promise<BatchCaptionResult> {
  const fd = new FormData();
  fd.append("manifest", file);
  if (opts?.trigger_word) fd.append("trigger_word", opts.trigger_word);
  fd.append("write_sidecar", String(opts?.write_sidecar ?? true));
  fd.append("write_xmp", String(opts?.write_xmp ?? false));
  appendHybrid(fd, opts);
  const resp = await fetch(`${LENS_URL}/caption/manifest`, { method: "POST", body: fd });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export interface CaptionProgress {
  done: number;
  total: number;
  rel_path: string;
  final_caption?: string;
  error?: string;
}

export interface CaptionSummary {
  total: number;
  captioned: number;
  failed: number;
}

/**
 * Read an NDJSON response line by line, invoking `onLine` with each parsed
 * object (the trailing partial line is buffered until complete).
 */
async function readNdjson(resp: Response, onLine: (obj: Record<string, unknown>) => void): Promise<void> {
  if (!resp.body) throw new Error("Response has no body to stream");
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (trimmed) onLine(JSON.parse(trimmed));
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line);
  }
  if (buffer.trim()) handleLine(buffer);
}

/**
 * Stream captioning of a JSONL manifest (POST /caption/manifest/stream). Parses
 * the NDJSON progress lines, invoking `onProgress` per image, and resolves with
 * the final {total, captioned, failed} summary. Lens reads each row's abs_path
 * from the shared dataset volume and writes a .txt sidecar next to it.
 */
export async function captionManifestStream(
  manifestJsonl: string,
  onProgress: (p: CaptionProgress) => void,
  opts?: { trigger_word?: string; signal?: AbortSignal } & HybridBalanceParams,
): Promise<CaptionSummary> {
  const signal = opts?.signal;
  const form = new FormData();
  form.append("manifest", new Blob([manifestJsonl], { type: "application/x-ndjson" }), "manifest.jsonl");
  if (opts?.trigger_word) form.append("trigger_word", opts.trigger_word);
  appendHybrid(form, opts);

  const resp = await fetch(`${LENS_URL}/caption/manifest/stream`, {
    method: "POST",
    body: form,
    signal,
  });
  if (!resp.ok) return asError(resp);

  let summary: CaptionSummary | null = null;
  await readNdjson(resp, (obj) => {
    if (obj.type === "complete") summary = obj as unknown as CaptionSummary;
    else if (obj.type === "progress") onProgress(obj as unknown as CaptionProgress);
  });

  if (!summary) throw new Error("Caption stream ended without a summary");
  return summary;
}

/** One streamed result row from POST /caption/stream (a CaptionResult plus the upload's filename). */
export interface UploadCaptionRow extends CaptionResult {
  name: string;
}

export interface UploadCaptionParams extends HybridBalanceParams {
  trigger_word?: string;
  target_style?: string;
  target_category?: string;
  target_backend?: string;
}

/**
 * Caption browser-uploaded image files (POST /caption/stream), streaming one
 * NDJSON result line per image. `onResult` fires as each caption lands;
 * resolves with all rows. Files the server cannot decode are silently skipped
 * by the endpoint, so compare rows.length with files.length for failures.
 */
export async function captionFilesStream(
  files: File[],
  params: UploadCaptionParams,
  onResult: (row: UploadCaptionRow, done: number) => void,
  signal?: AbortSignal,
): Promise<UploadCaptionRow[]> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  if (params.trigger_word) fd.append("trigger_word", params.trigger_word);
  if (params.target_style) fd.append("target_style", params.target_style);
  if (params.target_category) fd.append("target_category", params.target_category);
  if (params.target_backend) fd.append("target_backend", params.target_backend);
  appendHybrid(fd, params);

  const resp = await fetch(`${LENS_URL}/caption/stream`, { method: "POST", body: fd, signal });
  if (!resp.ok) return asError(resp);

  const rows: UploadCaptionRow[] = [];
  await readNdjson(resp, (obj) => {
    const row = obj as unknown as UploadCaptionRow;
    rows.push(row);
    onResult(row, rows.length);
  });
  return rows;
}

// ── Immich (optional integration; lens returns 503 when not configured) ──

export interface ImmichAlbum {
  id: string;
  name: string;
  asset_count: number;
}

/** List Immich albums (GET /immich/albums). Requires IMMICH_URL/IMMICH_API_KEY on lens. */
export async function listImmichAlbums(signal?: AbortSignal): Promise<ImmichAlbum[]> {
  const resp = await fetch(`${LENS_URL}/immich/albums`, { signal });
  if (!resp.ok) return asError(resp);
  const data: { albums: ImmichAlbum[] } = await resp.json();
  return data.albums;
}

export interface ImmichCaptionRequest extends HybridBalanceParams {
  album_id: string;
  asset_ids?: string[] | null;
  trigger_word?: string;
  target_style?: string;
  target_category?: string;
  target_backend?: string;
  checkpoint?: string | null;
  prose_enrichment?: boolean;
  /** Push each caption back to Immich (asset description + keywords). */
  write_back?: boolean;
}

export interface ImmichCaptionProgress {
  done: number;
  total: number;
  asset_id: string;
  name: string;
  final_caption?: string;
  error?: string;
}

/**
 * Caption an Immich album (POST /immich/caption/stream), streaming NDJSON
 * progress per asset. Assets are fetched from Immich in memory — nothing is
 * written to the dataset. With write_back, captions land in Immich itself.
 */
export async function immichCaptionStream(
  req: ImmichCaptionRequest,
  onProgress: (p: ImmichCaptionProgress) => void,
  signal?: AbortSignal,
): Promise<CaptionSummary> {
  const resp = await fetch(`${LENS_URL}/immich/caption/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok) return asError(resp);

  let summary: CaptionSummary | null = null;
  await readNdjson(resp, (obj) => {
    if (obj.type === "complete") summary = obj as unknown as CaptionSummary;
    else if (obj.type === "progress") onProgress(obj as unknown as ImmichCaptionProgress);
  });
  if (!summary) throw new Error("Immich caption stream ended without a summary");
  return summary;
}

export interface ImmichPullRequest {
  album_id: string;
  asset_ids?: string[] | null;
  /** Folder (relative to the lens source root, i.e. the shared dataset) to download into. */
  dest_folder: string;
}

export interface ImmichPullProgress {
  done: number;
  total: number;
  name: string;
}

export interface ImmichPullResult {
  folder: string;
  downloaded: number;
  skipped: number;
  failed: number;
}

/**
 * Download an Immich album's originals into the shared dataset
 * (POST /immich/pull, NDJSON progress). The resulting folder can then be
 * scanned on /curate or batch-captioned as a local folder.
 */
export async function immichPullStream(
  req: ImmichPullRequest,
  onProgress: (p: ImmichPullProgress) => void,
  signal?: AbortSignal,
): Promise<ImmichPullResult> {
  const resp = await fetch(`${LENS_URL}/immich/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok) return asError(resp);

  let result: ImmichPullResult | null = null;
  await readNdjson(resp, (obj) => {
    if (obj.type === "complete") result = obj as unknown as ImmichPullResult;
    else if (obj.type === "progress") onProgress(obj as unknown as ImmichPullProgress);
  });
  if (!result) throw new Error("Immich pull stream ended without a result");
  return result;
}
