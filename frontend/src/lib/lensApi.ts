/** Thin client for the argus-lens API (:8100) batch/folder endpoints. */

import type { FolderListing } from "@/components/curator/types";
import type { BatchCaptionResult, CaptionFolderRequest, CaptionResult } from "@/types";
import { asError } from "@/lib/apiError";
import { capabilityOf, healthMemo, requireCapability, type Capability } from "@/lib/capabilities";

import { lensUrl } from "@/lib/curatorEnv";

/**
 * Server-side captioning profiles (GET /profiles): lens's own taxonomy, so the
 * UI doesn't hardcode it. The taxonomy fields are optional because older lens
 * builds returned only the hybrid presets.
 */
export interface LensProfiles {
  /** Named balance stops → prose_bias value, e.g. {tags:0.2, balanced:0.5, prose:0.85}. */
  hybrid_presets: Record<string, number>;
  /** The preset applied when neither hybrid_preset nor prose_bias is sent. */
  default_hybrid_preset: string;
  /** Caption categories lens can select, in its definition order. */
  target_categories?: string[];
  target_styles?: string[];
  target_backends?: string[];
  token_budgets?: Record<string, number>;
}

/**
 * The category options to offer, from lens's `/profiles` when it lists any.
 * Lens does not validate `target_category`, and an unknown one returns an
 * EMPTY caption (argus-studio#102), so the server's list beats a hardcoded one.
 * Labels come from `known` when it has the value; others are title-cased.
 */
export function categoryOptions<T extends { value: string; label: string }>(
  names: readonly string[] | undefined,
  known: readonly T[],
): { value: string; label: string }[] {
  const clean = (names ?? []).filter((n): n is string => typeof n === "string" && n.length > 0);
  if (clean.length === 0) return known.map(({ value, label }) => ({ value, label }));
  return clean.map((value) => ({
    value,
    label:
      known.find((k) => k.value === value)?.label ??
      value
        .split("_")
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" "),
  }));
}

/** GET /health. Lens advertises no write flags yet (#105), only where it can read and write. */
export interface LensHealth {
  status: string;
  service?: string;
  version?: string;
  /** The folder root lens browses and folder-captions under; null when none is configured. */
  source_root?: string | null;
}

async function fetchLensHealth(signal?: AbortSignal): Promise<LensHealth> {
  const resp = await fetch(`${lensUrl()}/health`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** The posture lens's write fetchers gate on (argus-studio#75). */
const lensHealth = healthMemo(fetchLensHealth);

export async function getLensHealth(signal?: AbortSignal): Promise<LensHealth> {
  return lensHealth.remember(await fetchLensHealth(signal));
}

/**
 * Whether lens can caption a server folder or pull Immich into one: both
 * resolve under `source_root`, and lens 400s every such request without it.
 * A string is a yes, an explicit null is a no, and a lens predating the field
 * is assumed configured (legacy permissive).
 */
export function allowsFolderWrites(health: LensHealth | null | undefined): Capability {
  return capabilityOf(health, (h) => (typeof h.source_root === "string" ? true : h.source_root === null ? false : undefined), true);
}

const NO_SOURCE_ROOT =
  "This lens has no source root configured, so it refuses folder captioning and Immich pulls (start it with --source-root or LENS_SOURCE_PATH).";

/** Fetch the lens captioning profiles, including hybrid tag↔prose presets (GET /profiles). */
export async function getLensProfiles(signal?: AbortSignal): Promise<LensProfiles> {
  const resp = await fetch(`${lensUrl()}/profiles`, { signal });
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
  const resp = await fetch(`${lensUrl()}/folders?${params.toString()}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Batch-caption every image in a server-side folder (POST /caption/folder). */
export async function captionFolder(req: CaptionFolderRequest): Promise<BatchCaptionResult> {
  await requireCapability(lensHealth, allowsFolderWrites, NO_SOURCE_ROOT);
  const resp = await fetch(`${lensUrl()}/caption/folder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/**
 * Options for the manifest endpoints. These take no category, style or hybrid
 * balance: every row carries the curator's `target_profile`.
 */
export interface ManifestCaptionOptions {
  trigger_word?: string;
  write_sidecar?: boolean;
  write_xmp?: boolean;
  /** Discard an existing `.xmp` instead of merging into it (lens ≥ 0.7; the default merges). */
  xmp_overwrite?: boolean;
  prose_enrichment?: boolean;
  /**
   * Server path of the curator export root. Manifest 2.0 rows are then read
   * from `export_root / exported_path`, which stays valid after a move export;
   * without it lens reads `abs_path`, which needs a volume shared with the curator.
   */
  export_root?: string;
}

function appendManifestOptions(fd: FormData, opts?: ManifestCaptionOptions): void {
  if (opts?.trigger_word) fd.append("trigger_word", opts.trigger_word);
  fd.append("write_sidecar", String(opts?.write_sidecar ?? true));
  fd.append("write_xmp", String(opts?.write_xmp ?? false));
  if (opts?.xmp_overwrite != null) fd.append("xmp_overwrite", String(opts.xmp_overwrite));
  if (opts?.prose_enrichment != null) fd.append("prose_enrichment", String(opts.prose_enrichment));
  if (opts?.export_root?.trim()) fd.append("export_root", opts.export_root.trim());
}

/** Batch-caption an argus-curator JSONL manifest (POST /caption/manifest). */
export async function captionManifest(file: File, opts?: ManifestCaptionOptions): Promise<BatchCaptionResult> {
  const fd = new FormData();
  fd.append("manifest", file);
  appendManifestOptions(fd, opts);
  const resp = await fetch(`${lensUrl()}/caption/manifest`, { method: "POST", body: fd });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export interface CaptionProgress {
  done: number;
  total: number;
  rel_path: string;
  final_caption?: string;
  error?: string;
  /** Where the `.xmp` sidecar was written, when `write_xmp` wrote one. */
  xmp_path?: string;
}

export interface CaptionSummary {
  total: number;
  captioned: number;
  failed: number;
  /** Sidecars written (manifest streams, lens ≥ 0.7). */
  xmp_written?: number;
}

/**
 * Read an NDJSON response line by line, invoking `onLine` with each parsed
 * object (the trailing partial line is buffered until complete). Shared by the
 * lens caption streams and the proof run stream (proofApi.ts).
 */
export async function readNdjson(resp: Response, onLine: (obj: Record<string, unknown>) => void): Promise<void> {
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
  opts?: ManifestCaptionOptions & { signal?: AbortSignal },
): Promise<CaptionSummary> {
  const signal = opts?.signal;
  const form = new FormData();
  form.append("manifest", new Blob([manifestJsonl], { type: "application/x-ndjson" }), "manifest.jsonl");
  appendManifestOptions(form, opts);

  const resp = await fetch(`${lensUrl()}/caption/manifest/stream`, {
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

/** A per-image failure line from POST /caption/stream (e.g. a replay-backend miss). */
export interface UploadCaptionError {
  name: string;
  error: string;
}

export interface UploadCaptionResult {
  rows: UploadCaptionRow[];
  errors: UploadCaptionError[];
}

/** Tell a stream line that failed apart from a caption. Exported for tests. */
export function isUploadCaptionError(obj: Record<string, unknown>): boolean {
  return typeof obj.error === "string" && !("final_caption" in obj);
}

export interface UploadCaptionParams extends HybridBalanceParams {
  trigger_word?: string;
  target_style?: string;
  target_category?: string;
  target_backend?: string;
}

/**
 * Caption browser-uploaded image files (POST /caption/stream), streaming one
 * NDJSON line per image. `onResult` fires as each line lands (`done` counts
 * captions and failures). Resolves with the captions and the per-image failures
 * apart. Files the server cannot decode are silently skipped by the endpoint, so
 * compare rows + errors with files.length to count those.
 */
export async function captionFilesStream(
  files: File[],
  params: UploadCaptionParams,
  onResult: (row: UploadCaptionRow | UploadCaptionError, done: number) => void,
  signal?: AbortSignal,
): Promise<UploadCaptionResult> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  if (params.trigger_word) fd.append("trigger_word", params.trigger_word);
  if (params.target_style) fd.append("target_style", params.target_style);
  if (params.target_category) fd.append("target_category", params.target_category);
  if (params.target_backend) fd.append("target_backend", params.target_backend);
  appendHybrid(fd, params);

  const resp = await fetch(`${lensUrl()}/caption/stream`, { method: "POST", body: fd, signal });
  if (!resp.ok) return asError(resp);

  const rows: UploadCaptionRow[] = [];
  const errors: UploadCaptionError[] = [];
  await readNdjson(resp, (obj) => {
    if (isUploadCaptionError(obj)) {
      const e = obj as unknown as UploadCaptionError;
      errors.push(e);
      onResult(e, rows.length + errors.length);
    } else {
      const row = obj as unknown as UploadCaptionRow;
      rows.push(row);
      onResult(row, rows.length + errors.length);
    }
  });
  return { rows, errors };
}

// ── Immich (optional integration; lens returns 503 when not configured) ──

export interface ImmichAlbum {
  id: string;
  name: string;
  asset_count: number;
}

/** List Immich albums (GET /immich/albums). Requires IMMICH_URL/IMMICH_API_KEY on lens. */
export async function listImmichAlbums(signal?: AbortSignal): Promise<ImmichAlbum[]> {
  const resp = await fetch(`${lensUrl()}/immich/albums`, { signal });
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
  /** Push each caption back to Immich (asset description + keywords). The server defaults this to false. */
  write_back?: boolean;
  /** Also write an `.xmp` sidecar per asset (lens ≥ 0.7). */
  write_xmp?: boolean;
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
  const resp = await fetch(`${lensUrl()}/immich/caption/stream`, {
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
  await requireCapability(lensHealth, allowsFolderWrites, NO_SOURCE_ROOT, signal);
  const resp = await fetch(`${lensUrl()}/immich/pull`, {
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
