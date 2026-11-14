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
import { STATIC_DEMO, demoAsset } from "@/lib/staticDemo";

/*
 * Static demo (lib/staticDemo.ts): the read side — job list, job sidecars,
 * previews, the PMTiles archive — is served from recorded argus-atlas jobs
 * bundled under public/demo/atlas/ by scripts/bundle_atlas_demo.py (what the
 * real GET /jobs, GET /jobs/{id} and GET /jobs/{id}/labels returned for them,
 * with host paths made relative). The write side
 * (controls, OSM, bake, tiles) is never offered by the page.
 */

/** The live map of the island bake the bundled jobs are chunks of. */
export { REALMS_URL } from "@/lib/staticDemo";

/**
 * Jobs whose PMTiles archive is bundled in the static demo. None are, to keep
 * the export small (each is 1.6-3 MB): every job links to {@link REALMS_URL},
 * which serves the same archives as a live map.
 */
export const DEMO_BUNDLED_ARCHIVES: ReadonlySet<string> = new Set<string>();

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
  /** The style recipe these params came from. Only `argus-atlas chunk` sets it. */
  recipe?: string | null;
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

/** A job baked as one XYZ tile. `image` stays null until the crop to `inner` passes its gate. */
export interface ChunkRecord {
  z: number;
  x: number;
  y: number;
  size: number;
  margin: number;
  inner: Grid;
  neighbours: { tile: string; job_id: string; image: FileRef }[];
  image: FileRef | null;
}

/** The recipe a chunk was baked with, and the digest of its canonical JSON. */
export interface RecipeRecord {
  recipe: {
    name: string;
    preset: string | null;
    checkpoint: string;
    lora: string | null;
    /** 0.3: `"auto"` (latitude-corrected) or a fixed factor; absent before 0.3. */
    z_factor?: "auto" | number;
    vertical_exaggeration?: number;
  };
  sha256: string;
}

/**
 * 0.3: how the DEM's heights were scaled for hillshade and slope. Web Mercator
 * flattens relief by cos(latitude); `auto` restores it with `base` = that factor
 * at the canvas centre, and `z_factor = base * vertical_exaggeration`.
 */
export interface ReliefRecord {
  mode: "auto" | "fixed";
  latitude: number;
  base: number;
  vertical_exaggeration: number;
  z_factor: number;
}

export type LabelScheme = "naturalearth" | "osm" | null;

/** Place names `argus-atlas labels --job` wrote. A CLI step: no route builds them. */
export interface LabelsRecord {
  source: FileRef;
  scheme: LabelScheme;
  zoom: number;
  cutoff: string;
  count: number;
  file: FileRef;
  completed_at: string;
}

/** GET /jobs/{id}/labels: EPSG:4326 points, most important (lowest rank) first. */
export interface LabelFeature {
  type: "Feature";
  properties: { name: string; rank: number; kind: string };
  geometry: { type: string; coordinates: number[] };
}

export interface LabelCollection {
  type: "FeatureCollection";
  features: LabelFeature[];
}

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
  // Optional: sidecar 0.2 added chunk, recipe and timings; 0.3 added labels and relief.
  chunk?: ChunkRecord | null;
  recipe?: RecipeRecord | null;
  labels?: LabelsRecord | null;
  relief?: ReliefRecord | null;
  /** Wall-clock seconds per stage. */
  timings?: Record<string, number>;
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
  has_labels?: boolean;
  /** `z/x/y` for a chunk job. */
  chunk?: string | null;
  recipe?: string | null;
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

/**
 * An OSM extract under ATLAS_DEM_DIR; `layers` maps layer name -> the vector name
 * /controls takes. `name` is the directory (`osm/garda`), and `bbox` is whatever
 * `osm.json` recorded, which is the `west,south,east,north` text.
 */
export interface OsmExtract {
  name: string;
  bbox: string | number[] | null;
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

/** The engine as `GET /doctor` found it. */
export interface DoctorBackend {
  name: string;
  reachable: boolean;
  version: string | null;
  detail: string | null;
}

/** GET /doctor: everything a bake needs, probed on the host. */
export interface AtlasDoctor {
  gdal: {
    version: string | null;
    /** Each GDAL tool atlas calls -> its resolved path, or null when missing. */
    tools: Record<string, string | null>;
    tiler: string | null;
  };
  pmtiles: { library: string | null; cli: string | null };
  backend: DoctorBackend;
  bake_allowed: boolean;
  jobs_dir: string;
  dem_dir: string;
  models_dir: string;
  workflow: string;
}

// --- capabilities ------------------------------------------------------------

/** Live baking (POST /bake/stream). Off unless the host sets ATLAS_ALLOW_BAKE=1. */
export function allowsBake(health: AtlasHealth | null): Capability {
  return capabilityOf(health, (h) => (typeof h.read_only === "boolean" ? !h.read_only : undefined), false);
}

/**
 * GDAL on the host, which `POST /controls`, `/tiles` and `/osm` all need (503
 * without it). A read-only host still allows them: `read_only` is about baking.
 */
export function allowsGdal(health: AtlasHealth | null): Capability {
  return capabilityOf(health, (h) => (h.gdal === undefined ? undefined : h.gdal !== null), true);
}

/** The server fetching OSM itself (POST /osm). Off unless the host sets ATLAS_ALLOW_OSM=1. */
export function allowsOsm(health: AtlasHealth | null): Capability {
  return capabilityOf(health, (h) => h.osm_allowed, false);
}

// --- reads -------------------------------------------------------------------

async function fetchAtlasHealth(signal?: AbortSignal): Promise<AtlasHealth> {
  const resp = await fetch(`${atlasUrl()}/health`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** The posture the write fetchers gate on. */
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
  const resp = await fetch(STATIC_DEMO ? demoAsset("atlas/jobs.json") : `${atlasUrl()}/jobs`, { signal });
  if (!resp.ok) return asError(resp);
  const body = (await resp.json()) as { jobs: JobDigest[] };
  return body.jobs;
}

export async function getJob(jobId: string, signal?: AbortSignal): Promise<AtlasJob> {
  const resp = await fetch(
    STATIC_DEMO
      ? demoAsset(`atlas/${encodeURIComponent(jobId)}/job.json`)
      : `${atlasUrl()}/jobs/${encodeURIComponent(jobId)}`,
    { signal },
  );
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** GET /doctor. Probes the bake backend over HTTP, so it can take a while on a dead host. */
export async function getDoctor(signal?: AbortSignal): Promise<AtlasDoctor> {
  const resp = await fetch(`${atlasUrl()}/doctor`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** A job's place names. 404s when `job.json` records none or the file has gone. */
export async function getLabels(jobId: string, signal?: AbortSignal): Promise<LabelCollection> {
  const resp = await fetch(
    STATIC_DEMO
      ? demoAsset(`atlas/${encodeURIComponent(jobId)}/labels.geojson`)
      : `${atlasUrl()}/jobs/${encodeURIComponent(jobId)}/labels`,
    { signal },
  );
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/**
 * A control (`hillshade`, `slope`, `composite`, `land`, a layer name) or the
 * painted `fantasy` image as PNG. `version` busts the browser cache when a
 * re-bake replaces the image under the same URL.
 */
export function previewUrl(jobId: string, kind: string, version?: string): string {
  if (STATIC_DEMO) return demoAsset(`atlas/${encodeURIComponent(jobId)}/${encodeURIComponent(kind)}.webp`);
  const base = `${atlasUrl()}/jobs/${encodeURIComponent(jobId)}/preview/${encodeURIComponent(kind)}`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

/** The PMTiles archive (only after POST /tiles). */
export function archiveUrl(jobId: string): string {
  if (STATIC_DEMO) return demoAsset(`atlas/${encodeURIComponent(jobId)}/fantasy.pmtiles`);
  return `${atlasUrl()}/jobs/${encodeURIComponent(jobId)}/archive`;
}

// --- writes ------------------------------------------------------------------

const NO_GDAL = "GDAL is missing on this argus-atlas host. Use the Docker image, which ships GDAL 3.11.";

/** gdalwarp methods atlas accepts (`gdal_ops.RESAMPLING_METHODS`); leave it unset for atlas's auto choice. */
export const RESAMPLING_METHODS = ["bilinear", "cubic", "cubicspline", "lanczos", "average"] as const;
export type Resampling = (typeof RESAMPLING_METHODS)[number];

/** POST /controls — names, not paths: `dem` and layer files are relative to ATLAS_DEM_DIR. */
export interface ControlsRequest {
  dem: string;
  /** `west,south,east,north` in degrees. */
  bbox: string;
  land?: string;
  layers?: Record<string, string>;
  sea_level?: number;
  resampling?: Resampling;
  long_side?: number;
  resolution?: number;
  job_id?: string;
}

/** Plan the canvas and write the GDAL controls for a new job (CPU only, allowed on read-only hosts). */
export async function createControls(req: ControlsRequest, signal?: AbortSignal): Promise<AtlasJob> {
  await requireCapability(atlasHealth, allowsGdal, NO_GDAL, signal);
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
 * Layers `POST /osm` can fetch for a canvas. `places` also exists but is left out:
 * it feeds `argus-atlas labels`, which has no route, and is never a control.
 */
export const OSM_LAYERS = ["water", "rivers", "roads", "rail", "forest", "urban", "buildings", "glaciers"] as const;
/** What `POST /osm` fetches when it is not told. */
export const OSM_DEFAULT_LAYERS: readonly string[] = ["water", "rivers", "roads", "forest", "urban"];

export interface OsmRequest {
  /** The extract's directory under `<ATLAS_DEM_DIR>/osm/`: an id, never a path. */
  name: string;
  /** `west,south,east,north` in degrees. */
  bbox: string;
  zoom?: number;
  layers?: string[];
}

export interface OsmResult {
  name: string;
  /** Layer name -> the vector name /controls takes. */
  layers: Record<string, string>;
  /** Asked for but empty at this zoom (`buildings` below 13). */
  skipped: string[];
  osm_base: string | null;
  extract_bytes: number;
}

/** Fetch OSM layers from Overpass into `ATLAS_DEM_DIR/osm/<name>/`, replacing an extract of that name. */
export async function fetchOsm(req: OsmRequest, signal?: AbortSignal): Promise<OsmResult> {
  await requireCapability(
    atlasHealth,
    allowsOsm,
    "OSM fetching is off on this argus-atlas host (set ATLAS_ALLOW_OSM=1 to enable it).",
    signal,
  );
  await requireCapability(atlasHealth, allowsGdal, NO_GDAL, signal);
  const resp = await fetch(`${atlasUrl()}/osm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
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

/**
 * One NDJSON frame: `controls`, `generate`, `georeference`, then `done` or `error`.
 * `tiles` frames follow `done` in atlas's `chunk` command; `POST /bake/stream`
 * doesn't send them at 0.3.0a1, but they are on the wire type.
 */
export interface BakeProgress {
  job_id: string;
  type: "controls" | "generate" | "georeference" | "tiles" | "done" | "error";
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

/**
 * `POST /tiles` answered 409: the job has nothing gated to tile. Atlas's
 * NotTileableError (a chunk whose crop failed), no aligned GeoTIFF, or the
 * alignment gate failing on the re-check. The message is the server's reason.
 */
export class NotTileableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotTileableError";
  }
}

/** Cut the PMTiles archive for an aligned bake (re-runs the alignment gate first). */
export async function cutTiles(jobId: string, signal?: AbortSignal): Promise<TilesRecord> {
  await requireCapability(atlasHealth, allowsGdal, NO_GDAL, signal);
  const resp = await fetch(`${atlasUrl()}/tiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId }),
    signal,
  });
  if (resp.status === 409) {
    const refused: Error = await asError(resp).catch((err) => err);
    throw new NotTileableError(refused.message);
  }
  if (!resp.ok) return asError(resp);
  return resp.json();
}
