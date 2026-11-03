/**
 * Thin client for the argus-atlas API (:8105) — one georeferenced fantasy-map
 * overlay baked from real terrain. Shapes mirror `argus_atlas.models` (the job
 * sidecar `job.json` is the contract) and the routes in
 * `argus_atlas/server/app.py`. Follows the proofApi.ts pattern.
 *
 * Atlas stays the authority on georeferencing: studio only names inputs that
 * live under the server's `ATLAS_DEM_DIR` and addresses every artifact by job
 * id, never by path.
 */

import { atlasUrl } from "@/lib/curatorEnv";
import { asError } from "@/lib/apiError";
import { capabilityOf, healthMemo, requireCapability, type Capability } from "@/lib/capabilities";
import { readNdjson } from "@/lib/lensApi";

// --- wire types (mirror argus_atlas.models) --------------------------------

/** An AOI in EPSG:4326 degrees. */
export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** The canvas grid in EPSG:3857, fixed before generation. */
export interface Grid {
  crs: string;
  width: number;
  height: number;
  ulx: number;
  uly: number;
  pixel_width: number;
  pixel_height: number;
}

/** A file pinned by content hash. */
export interface FileRef {
  path: string;
  sha256: string;
}

export interface GdalCommand {
  tool: string;
  argv: string[];
}

export interface ModelRef {
  name: string;
  sha256: string;
}

export interface BakeParams {
  checkpoint: string;
  lora: string | null;
  lora_weight: number;
  prompt: string;
  negative: string;
  seed: number;
  steps: number;
  cfg: number;
  denoise: number;
  sampler: string;
  scheduler: string;
  preset: string | null;
}

/** `aligned` is the alignment-gate verdict; a failed gate keeps the PNG and leaves `geotiff` null. */
export interface BakeRecord {
  params: BakeParams;
  backend: string;
  engine_version: string;
  checkpoint: ModelRef;
  lora: ModelRef | null;
  workflow_sha256: string | null;
  image: FileRef;
  geotiff: FileRef | null;
  aligned: boolean;
  error: string | null;
  completed_at: string;
}

export interface TilesRecord {
  archive: FileRef;
  min_zoom: number;
  max_zoom: number;
  native_zoom: number;
  n_tiles: number;
  tiler: string;
  packer: string;
  completed_at: string;
}

export type JobStatus = "controls" | "baked" | "unaligned" | "tiled";

/** `job.json` — everything about one canvas, from DEM to archive. */
export interface JobSidecar {
  atlas_version: string;
  job_id: string;
  created_at: string;
  dem: FileRef;
  land_source: FileRef | null;
  layer_sources: Record<string, FileRef>;
  bbox: BBox;
  grid: Grid;
  resolution: number;
  native_zoom: number;
  zoom_range: [number, number];
  controls: Record<string, FileRef>;
  commands: GdalCommand[];
  bake: BakeRecord | null;
  tiles: TilesRecord | null;
}

/** One row of GET /jobs. */
export interface JobDigest {
  job_id: string;
  created_at: string;
  status: JobStatus;
  bbox: BBox;
  width: number;
  height: number;
  resolution: number;
  native_zoom: number;
  has_land: boolean;
  layers: string[];
  has_composite: boolean;
  has_archive: boolean;
}

export interface AtlasJob {
  job_id: string;
  status: JobStatus;
  sidecar: JobSidecar;
}

export interface AtlasHealth {
  status: string;
  service: string;
  version: string;
  /** True when live baking is off (ATLAS_ALLOW_BAKE unset). */
  read_only?: boolean;
  /** True when the server may fetch OSM itself (ATLAS_ALLOW_OSM=1). */
  osm_allowed?: boolean;
  /** GDAL version, or null when GDAL is missing on the host. */
  gdal?: string | null;
}

/** A named style (GET /presets) — the demo's fixed menu instead of free-text prompts. */
export interface AtlasPreset {
  name: string;
  title: string;
  prompt: string;
  negative: string;
  denoise: number;
  cfg: number;
  steps: number;
  blurb: string;
  recommended: boolean;
}

/** An OSM extract under ATLAS_DEM_DIR; `layers` maps layer name -> the vector name /controls takes. */
export interface OsmExtract {
  name: string;
  bbox: number[] | null;
  zoom: number | null;
  osm_base: string | null;
  layers: Record<string, string>;
}

/** GET /inputs: what POST /controls may name. */
export interface AtlasInputs {
  root: string;
  dems: string[];
  vectors: string[];
  osm: OsmExtract[];
}

// --- capabilities ------------------------------------------------------------

/** Live baking (POST /bake/stream). Off unless the host sets ATLAS_ALLOW_BAKE=1. */
export function allowsBake(health: AtlasHealth | null): Capability {
  return capabilityOf(health, (h) => (typeof h.read_only === "boolean" ? !h.read_only : undefined), false);
}

// --- reads -------------------------------------------------------------------

async function fetchAtlasHealth(signal?: AbortSignal): Promise<AtlasHealth> {
  const resp = await fetch(`${atlasUrl()}/health`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** The posture {@link bakeStream} gates on. */
const atlasHealth = healthMemo(fetchAtlasHealth);

export async function getAtlasHealth(signal?: AbortSignal): Promise<AtlasHealth> {
  return atlasHealth.remember(await fetchAtlasHealth(signal));
}

export async function listPresets(signal?: AbortSignal): Promise<AtlasPreset[]> {
  const resp = await fetch(`${atlasUrl()}/presets`, { signal });
  if (!resp.ok) return asError(resp);
  const body = (await resp.json()) as { presets: AtlasPreset[] };
  return body.presets;
}

export async function getInputs(signal?: AbortSignal): Promise<AtlasInputs> {
  const resp = await fetch(`${atlasUrl()}/inputs`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export async function listJobs(signal?: AbortSignal): Promise<JobDigest[]> {
  const resp = await fetch(`${atlasUrl()}/jobs`, { signal });
  if (!resp.ok) return asError(resp);
  const body = (await resp.json()) as { jobs: JobDigest[] };
  return body.jobs;
}

export async function getJob(jobId: string, signal?: AbortSignal): Promise<AtlasJob> {
  const resp = await fetch(`${atlasUrl()}/jobs/${encodeURIComponent(jobId)}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/**
 * A control (`hillshade`, `slope`, `composite`, `land`, a layer name) or the
 * painted `fantasy` image as PNG. `version` busts the browser cache when a
 * re-bake replaces the image under the same URL.
 */
export function previewUrl(jobId: string, kind: string, version?: string): string {
  const base = `${atlasUrl()}/jobs/${encodeURIComponent(jobId)}/preview/${encodeURIComponent(kind)}`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

/** The PMTiles archive (only after POST /tiles). */
export function archiveUrl(jobId: string): string {
  return `${atlasUrl()}/jobs/${encodeURIComponent(jobId)}/archive`;
}

// --- writes ------------------------------------------------------------------

/** POST /controls — names, not paths: `dem` and layer files are relative to ATLAS_DEM_DIR. */
export interface ControlsRequest {
  dem: string;
  /** `west,south,east,north` in degrees. */
  bbox: string;
  land?: string;
  layers?: Record<string, string>;
  sea_level?: number;
  long_side?: number;
  resolution?: number;
  job_id?: string;
}

/** Plan the canvas and write the GDAL controls for a new job (CPU only, allowed on read-only hosts). */
export async function createControls(req: ControlsRequest): Promise<AtlasJob> {
  const resp = await fetch(`${atlasUrl()}/controls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** POST /bake/stream. A preset fills prompt/negative/denoise/cfg/steps; explicit values win. */
export interface BakeRequest {
  job_id: string;
  checkpoint: string;
  lora?: string;
  lora_weight?: number;
  preset?: string;
  prompt?: string;
  negative?: string;
  seed?: number;
  steps?: number;
  cfg?: number;
  denoise?: number;
}

/** One NDJSON frame: `controls`, `generate`, `georeference`, then `done` or `error`. */
export interface BakeProgress {
  job_id: string;
  type: "controls" | "generate" | "georeference" | "done" | "error";
  message: string;
}

/** Bake one job, streaming progress. Rejects on an `error` frame (e.g. a failed alignment gate). */
export async function bakeStream(
  req: BakeRequest,
  onProgress: (p: BakeProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  await requireCapability(
    atlasHealth,
    allowsBake,
    "Baking is off on this argus-atlas host (set ATLAS_ALLOW_BAKE=1 on a GPU host to enable it).",
    signal,
  );
  const resp = await fetch(`${atlasUrl()}/bake/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok) return asError(resp);

  let streamedError: string | null = null;
  let done = false;
  await readNdjson(resp, (obj) => {
    const frame = obj as unknown as BakeProgress;
    onProgress(frame);
    if (frame.type === "done") done = true;
    else if (frame.type === "error") streamedError = frame.message || "bake failed";
  });

  if (streamedError) throw new Error(streamedError);
  if (!done) throw new Error("Bake stream ended without a result");
}

/** Cut the PMTiles archive for an aligned bake (re-runs the alignment gate first). */
export async function cutTiles(jobId: string): Promise<TilesRecord> {
  const resp = await fetch(`${atlasUrl()}/tiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId }),
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}
