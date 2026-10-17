/**
 * Thin client for the argus-atlas API (:8105) — georeferenced fantasy-map bakes.
 * Shapes mirror `argus_atlas.models` (smk762/argus-atlas): a job sidecar per
 * canvas holding the EPSG:3857 grid (the georeferencing authority), the control
 * rasters, the bake record and the PMTiles record. Follows the proofApi.ts
 * pattern: names and ids only, never client-supplied filesystem paths.
 */

import { atlasUrl } from "@/lib/curatorEnv";
import { asError } from "@/lib/apiError";
import { capabilityOf, type Capability } from "@/lib/capabilities";
import { readNdjson } from "@/lib/lensApi";

// --- wire types (mirror argus_atlas.models) --------------------------------

export interface AtlasBBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** The north-up EPSG:3857 pixel grid of one canvas. */
export interface AtlasGrid {
  crs: string;
  width: number;
  height: number;
  ulx: number;
  uly: number;
  pixel_width: number;
  pixel_height: number;
}

export interface AtlasFileRef {
  path: string;
  sha256: string;
}

export interface AtlasBakeParams {
  checkpoint: string;
  lora: string | null;
  lora_weight: number;
  prompt: string;
  negative: string;
  seed: number;
  steps: number;
  cfg: number;
  denoise: number;
}

export interface AtlasBakeRecord {
  params: AtlasBakeParams;
  backend: string;
  engine_version: string;
  /** The alignment-gate verdict; false keeps the PNG and writes no GeoTIFF. */
  aligned: boolean;
  error: string | null;
  geotiff: AtlasFileRef | null;
  completed_at: string;
}

export interface AtlasTilesRecord {
  archive: AtlasFileRef;
  min_zoom: number;
  max_zoom: number;
  native_zoom: number;
  n_tiles: number;
  tiler: string;
  packer: string;
  completed_at: string;
}

export type AtlasJobStatus = "controls" | "baked" | "unaligned" | "tiled";

export interface AtlasSidecar {
  atlas_version: string;
  job_id: string;
  created_at: string;
  dem: AtlasFileRef;
  bbox: AtlasBBox;
  grid: AtlasGrid;
  resolution: number;
  native_zoom: number;
  zoom_range: [number, number];
  controls: Record<string, AtlasFileRef>;
  bake: AtlasBakeRecord | null;
  tiles: AtlasTilesRecord | null;
}

/** One row of GET /jobs. */
export interface AtlasJobDigest {
  job_id: string;
  created_at: string;
  status: AtlasJobStatus;
  bbox: AtlasBBox;
  width: number;
  height: number;
  resolution: number;
  native_zoom: number;
  has_land: boolean;
  has_archive: boolean;
}

export interface AtlasJob {
  job_id: string;
  status: AtlasJobStatus;
  sidecar: AtlasSidecar;
}

export type AtlasPreviewKind = "hillshade" | "slope" | "land" | "fantasy";

/** POST /controls — `dem` and `land` are *names under ATLAS_DEM_DIR*, never paths. */
export interface ControlsRequest {
  dem: string;
  /** `west,south,east,north` in EPSG:4326 degrees, or the four numbers. */
  bbox: string | number[];
  land?: string;
  long_side?: number;
  resolution?: number;
  job_id?: string;
}

/** POST /bake/stream — mirrors the server's BakeStreamRequest. */
export interface BakeRequest {
  job_id: string;
  checkpoint: string;
  lora?: string;
  lora_weight?: number;
  prompt?: string;
  negative?: string;
  seed?: number;
  steps?: number;
  cfg?: number;
  denoise?: number;
}

/** One NDJSON frame from POST /bake/stream, in order: controls, generate,
 * georeference, then done or error. */
export interface BakeProgress {
  job_id: string;
  type: "controls" | "generate" | "georeference" | "done" | "error";
  message: string;
}

export interface AtlasHealth {
  status: string;
  service: string;
  version: string;
  /** True when live baking is disabled (ATLAS_ALLOW_BAKE unset) — the default. */
  read_only: boolean;
  /** GDAL version string, or null when GDAL is missing (controls/tiles cannot run). */
  gdal: string | null;
}

/**
 * Whether this server will accept POST /bake/stream. Atlas has always
 * advertised `read_only`, and its default is refused, so a payload that
 * somehow lacks the field is treated as refused (legacy `false`).
 */
export function allowsBake(health: AtlasHealth | null): Capability {
  return capabilityOf(health, (h) => (typeof h.read_only === "boolean" ? !h.read_only : undefined), false);
}

// --- fetchers --------------------------------------------------------------

export async function getAtlasHealth(signal?: AbortSignal): Promise<AtlasHealth> {
  const resp = await fetch(`${atlasUrl()}/health`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export async function listJobs(signal?: AbortSignal): Promise<AtlasJobDigest[]> {
  const resp = await fetch(`${atlasUrl()}/jobs`, { signal });
  if (!resp.ok) return asError(resp);
  const body = (await resp.json()) as { jobs: AtlasJobDigest[] };
  return body.jobs;
}

export async function getJob(jobId: string, signal?: AbortSignal): Promise<AtlasJob> {
  const resp = await fetch(`${atlasUrl()}/jobs/${encodeURIComponent(jobId)}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Plan a canvas and write the GDAL controls for a new job (no GPU). */
export async function createControls(req: ControlsRequest, signal?: AbortSignal): Promise<AtlasJob> {
  const resp = await fetch(`${atlasUrl()}/controls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/**
 * Bake one job (POST /bake/stream), streaming progress frames. Resolves once a
 * `done` frame arrives; a streamed `error` frame (including a failed alignment
 * gate) rejects with its message.
 */
export async function bakeStream(
  req: BakeRequest,
  onProgress: (p: BakeProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const resp = await fetch(`${atlasUrl()}/bake/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok) return asError(resp);

  let finished = false;
  let streamedError: string | null = null;
  await readNdjson(resp, (obj) => {
    const frame = obj as unknown as BakeProgress;
    onProgress(frame);
    if (frame.type === "done") finished = true;
    else if (frame.type === "error") streamedError = frame.message ?? "bake failed";
  });

  if (streamedError) throw new Error(streamedError);
  if (!finished) throw new Error("Bake stream ended without a result");
}

/** Cut the PMTiles archive for a baked job (POST /tiles); the server re-runs the alignment gate first. */
export async function buildTiles(jobId: string, signal?: AbortSignal): Promise<AtlasTilesRecord> {
  const resp = await fetch(`${atlasUrl()}/tiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId }),
    signal,
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** A control or the painted image (GET /jobs/{id}/preview/{kind}). `version`
 * busts the browser cache after a re-bake of the same job. */
export function previewUrl(jobId: string, kind: AtlasPreviewKind, version?: string): string {
  const base = `${atlasUrl()}/jobs/${encodeURIComponent(jobId)}/preview/${kind}`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

/** The PMTiles bytes (GET /jobs/{id}/archive). */
export function archiveUrl(jobId: string): string {
  return `${atlasUrl()}/jobs/${encodeURIComponent(jobId)}/archive`;
}
