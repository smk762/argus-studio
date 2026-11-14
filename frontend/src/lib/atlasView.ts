/**
 * Pure logic behind the /atlas page: where a place name lands on the canvas, how
 * stage timings read, how the relief was scaled, which OSM layers may become
 * controls, and what `/doctor` means for a bake. Mirrors `argus_atlas.mercator`,
 * `.labels` and `.tiles`.
 */

import type {
  AtlasDoctor,
  Grid,
  JobSidecar,
  LabelCollection,
  LabelScheme,
  OsmExtract,
  ReliefRecord,
} from "@/lib/atlasApi";

// --- place names ---------------------------------------------------------------

const EARTH_RADIUS = 6378137;
const MAX_LATITUDE = 85.05112878;

/** Enough for any legible canvas: a z14 job can hold far more names than fit on it. */
export const MAX_LABELS = 200;

/** EPSG:4326 degrees to EPSG:3857 metres, as `mercator.lonlat_to_mercator` does it. */
export function lonLatToMercator(lon: number, lat: number): [number, number] {
  const clamped = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
  const radians = (deg: number) => (deg * Math.PI) / 180;
  return [radians(lon) * EARTH_RADIUS, Math.asinh(Math.tan(radians(clamped))) * EARTH_RADIUS];
}

/** A point as a 0–1 fraction of the canvas, y counted from the top. Off the canvas is outside 0–1. */
export function canvasFraction(lon: number, lat: number, grid: Grid): { x: number; y: number } {
  const [mx, my] = lonLatToMercator(lon, lat);
  return {
    x: (mx - grid.ulx) / (grid.width * grid.pixel_width),
    // pixel_height is negative (north-up), so this grows southwards.
    y: (my - grid.uly) / (grid.height * grid.pixel_height),
  };
}

export interface PlacedLabel {
  name: string;
  rank: number;
  kind: string;
  x: number;
  y: number;
}

/**
 * The names to draw on a canvas, most important first, capped at `limit`. `total`
 * counts every name on the canvas, so the page can say when some were held back.
 * A chunk's names sit in its inner tile, which is inside the canvas `grid`.
 */
export function placeLabels(
  collection: LabelCollection,
  grid: Grid,
  limit = MAX_LABELS,
): { labels: PlacedLabel[]; total: number } {
  const placed: PlacedLabel[] = [];
  for (const feature of collection.features ?? []) {
    const coords = feature.geometry?.coordinates;
    if (feature.geometry?.type !== "Point" || !coords || coords.length < 2) continue;
    const { x, y } = canvasFraction(coords[0], coords[1], grid);
    if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) continue;
    const { name, rank, kind } = feature.properties;
    placed.push({ name, rank, kind, x, y });
  }
  placed.sort((a, b) => a.rank - b.rank);
  return { labels: placed.slice(0, limit), total: placed.length };
}

/** The credit a label overlay owes its source (`labels.LICENSES`). */
export function labelsCredit(scheme: LabelScheme): string | null {
  if (scheme === "osm") return "Names © OpenStreetMap contributors (ODbL 1.0)";
  if (scheme === "naturalearth") return "Names from Natural Earth (public domain)";
  return null;
}

// --- relief --------------------------------------------------------------------

/**
 * The 0.3 relief record in one line: the height factor hillshade and slope used,
 * then where it came from. Null for a job older than 0.3 (no correction, z 1).
 */
export function reliefSummary(
  relief: ReliefRecord | null | undefined,
): { value: string; short: string; detail: string } | null {
  if (!relief) return null;
  const ve = trim(relief.vertical_exaggeration);
  const veText = relief.vertical_exaggeration === 1 ? "no exaggeration" : `${ve}× exaggeration`;
  if (relief.mode === "fixed") {
    return { value: `z ${relief.z_factor.toFixed(2)}`, short: `fixed · VE ${ve}×`, detail: `fixed, ${veText}` };
  }
  const lat = `${Math.abs(relief.latitude).toFixed(1)}°${relief.latitude < 0 ? "S" : "N"}`;
  return {
    value: `z ${relief.z_factor.toFixed(2)}`,
    short: `auto · ${lat} · VE ${ve}×`,
    detail: `auto: Mercator correction ${relief.base.toFixed(2)} at ${lat}, ${veText}`,
  };
}

function trim(n: number): string {
  return Number(n.toFixed(2)).toString();
}

// --- stage timings -------------------------------------------------------------

/** Pipeline order. `blend` is what bake.py records for a chunk's seam matching. */
const STAGE_ORDER = ["controls", "seams", "verify", "generate", "georeference", "blend", "crop", "tiles"];

export function formatSeconds(seconds: number): string {
  if (seconds < 10) return `${seconds.toFixed(2)} s`;
  if (seconds < 59.95) return `${seconds.toFixed(1)} s`;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}m ${String(whole % 60).padStart(2, "0")}s`;
}

/** Stages in pipeline order, any stage this client doesn't know last, and the sum. */
export function stageTimings(timings: Record<string, number> | null | undefined): {
  stages: { stage: string; seconds: number; text: string }[];
  total: string | null;
} {
  const entries = Object.entries(timings ?? {}).filter(([, seconds]) => Number.isFinite(seconds));
  const position = (stage: string) => {
    const index = STAGE_ORDER.indexOf(stage);
    return index < 0 ? STAGE_ORDER.length : index;
  };
  entries.sort(([a], [b]) => position(a) - position(b) || a.localeCompare(b));
  return {
    stages: entries.map(([stage, seconds]) => ({ stage, seconds, text: formatSeconds(seconds) })),
    total: entries.length ? formatSeconds(entries.reduce((sum, [, seconds]) => sum + seconds, 0)) : null,
  };
}

// --- inputs --------------------------------------------------------------------

/** Atlas's id charset (`jobs.is_safe_id`), which an OSM extract's name must also meet. */
export function isSafeId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

/** What `GET /inputs` calls the extract `POST /osm` wrote under this name. */
export function osmExtractName(name: string): string {
  return `osm/${name}`;
}

/** An extract's bbox as the `west,south,east,north` text the form edits. */
export function bboxText(bbox: OsmExtract["bbox"]): string {
  if (typeof bbox === "string") return bbox;
  return bbox && bbox.length === 4 ? bbox.join(",") : "";
}

/** `places` is point data for `argus-atlas labels`; atlas says it is never a control. */
const NOT_CONTROLS = new Set(["places"]);

/** The layers of an extract that `POST /controls` should burn. */
export function controlLayers(extract: OsmExtract | undefined): Record<string, string> | undefined {
  if (!extract) return undefined;
  return Object.fromEntries(Object.entries(extract.layers).filter(([layer]) => !NOT_CONTROLS.has(layer)));
}

/** A GDAL virtual mosaic, which `GET /inputs` lists among the DEMs. */
export function isVrt(dem: string): boolean {
  return dem.toLowerCase().endsWith(".vrt");
}

// --- tiles ---------------------------------------------------------------------

/**
 * Why `POST /tiles` is bound to refuse this job, or null if it may work. A chunk
 * tiles its crop, and a failed crop leaves the bake aligned with `chunk.image`
 * null (`tiles.tile_source`), so `bake.aligned` alone doesn't say it can be cut.
 */
export function notTileableReason(sidecar: JobSidecar): string | null {
  const { chunk, bake } = sidecar;
  if (!chunk || !bake?.aligned || chunk.image) return null;
  const tile = `${chunk.z}/${chunk.x}/${chunk.y}`;
  return `Chunk ${tile} has no cropped tile to cut${bake.error ? ` (${bake.error})` : ""}. Bake it again.`;
}

// --- doctor --------------------------------------------------------------------

/** `off` is a host choice, not a fault: a read-only host is healthy. */
export type DoctorState = "ok" | "off" | "fail";

export interface DoctorCheck {
  label: string;
  state: DoctorState;
  detail: string;
}

/** What each `/doctor` field means for the pipeline, in pipeline order. */
export function doctorChecks(doctor: AtlasDoctor): DoctorCheck[] {
  const { gdal, pmtiles, backend, bake_allowed: bakeAllowed } = doctor;
  const missing = Object.entries(gdal.tools)
    .filter(([, path]) => path === null)
    .map(([tool]) => tool);
  const engine = [backend.name, backend.version].filter(Boolean).join(" ");
  return [
    {
      label: "GDAL",
      state: gdal.version && missing.length === 0 ? "ok" : "fail",
      detail: missing.length ? `missing ${missing.join(", ")}` : (gdal.version ?? "not installed"),
    },
    {
      label: "Tiler",
      state: gdal.tiler ? "ok" : "fail",
      detail: gdal.tiler ?? "gdal2tiles.py is not on PATH, so no archive can be cut",
    },
    {
      // The Go CLI converts MBTiles and cannot pack a directory, so only the library counts.
      label: "PMTiles packer",
      state: pmtiles.library ? "ok" : "fail",
      detail: pmtiles.library ?? "the Python pmtiles library is missing (argus-atlas[tiles])",
    },
    {
      label: "Baking",
      state: bakeAllowed ? "ok" : "off",
      detail: bakeAllowed ? "allowed" : "off (ATLAS_ALLOW_BAKE unset)",
    },
    {
      label: "Backend",
      state: backend.reachable ? "ok" : bakeAllowed ? "fail" : "off",
      detail: backend.reachable ? engine : `${engine} unreachable${backend.detail ? `: ${backend.detail}` : ""}`,
    },
  ];
}

/** One line for the collapsed panel. */
export function doctorSummary(checks: DoctorCheck[]): string {
  const failing = checks.filter((c) => c.state === "fail").map((c) => c.label);
  if (failing.length) return `Needs attention: ${failing.join(", ")}`;
  return checks.some((c) => c.state === "off") ? "Ready for controls and tiles; baking is off" : "Ready to bake";
}
