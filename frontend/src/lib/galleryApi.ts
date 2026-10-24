/** Thin client for the argus-quarry provenance API (:8102): the pool, plus the public-domain archives. */

import { asError } from "@/lib/apiError";
import { capabilityOf, healthMemo, requireCapability, type Capability } from "@/lib/capabilities";
import { readNdjson } from "@/lib/lensApi";

import { quarryUrl } from "@/lib/curatorEnv";

export interface QuarryHealth {
  status: string;
  service: string;
  version: string;
  quarry_home: string;
  /** QUARRY_ALLOW_FETCH=1 (newer quarry); absent on older servers. */
  fetch_allowed?: boolean;
}

async function fetchQuarryHealth(signal?: AbortSignal): Promise<QuarryHealth> {
  const resp = await fetch(`${quarryUrl()}/health`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** The posture {@link fetchSlice} gates on. */
const quarryHealth = healthMemo(fetchQuarryHealth);

export async function getQuarryHealth(signal?: AbortSignal): Promise<QuarryHealth> {
  return quarryHealth.remember(await fetchQuarryHealth(signal));
}

/**
 * Whether this server lands archive slices itself (`QUARRY_ALLOW_FETCH=1`).
 * Legacy `false`: a quarry that omits the field predates the fetch route.
 */
export function allowsFetch(health: QuarryHealth | null): Capability {
  return capabilityOf(health, (h) => h.fetch_allowed, false);
}

export interface QuarryStats {
  subjects: number;
  photographs: number;
  total_bytes: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_source: Record<string, number>;
  by_licence: Record<string, number>;
}

export async function getQuarryStats(signal?: AbortSignal): Promise<QuarryStats> {
  const resp = await fetch(`${quarryUrl()}/stats`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export interface QuarrySubject {
  folder: string;
  category: string;
  photo_count: number;
}

export async function listQuarrySubjects(category?: string, signal?: AbortSignal): Promise<QuarrySubject[]> {
  const params = new URLSearchParams(category ? { category } : {});
  const resp = await fetch(`${quarryUrl()}/subjects?${params.toString()}`, { signal });
  if (!resp.ok) return asError(resp);
  const data: { subjects: QuarrySubject[] } = await resp.json();
  return data.subjects;
}

export interface QuarryPhoto {
  id: number;
  subject: string;
  category: string;
  title: string | null;
  photographer: string | null;
  year: number | null;
  source: string;
  source_url: string;
  licence: string;
  attribution: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  filename: string | null;
  sha256: string | null;
  remote_url: string;
  status: string;
  downloaded_at: string | null;
}

export interface QuarryPhotoFilters {
  category?: string;
  subject?: string;
  licence?: string;
  source?: string;
  limit?: number;
  offset?: number;
}

export interface QuarryPhotoPage {
  total: number;
  offset: number;
  limit: number;
  photos: QuarryPhoto[];
}

export async function listQuarryPhotos(filters: QuarryPhotoFilters, signal?: AbortSignal): Promise<QuarryPhotoPage> {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.subject) params.set("subject", filters.subject);
  if (filters.licence) params.set("licence", filters.licence);
  if (filters.source) params.set("source", filters.source);
  params.set("limit", String(filters.limit ?? 60));
  params.set("offset", String(filters.offset ?? 0));
  const resp = await fetch(`${quarryUrl()}/photos?${params.toString()}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Build a /thumb URL for a pooled photograph. */
export function quarryThumbUrl(id: number, size = 384): string {
  return `${quarryUrl()}/thumb?id=${id}&size=${size}`;
}

// --- public-domain metadata archives (PD12M, Megalith-10m) -----------------
// Search runs over quarry's local DuckDB index of each archive; a *slice* is a
// saved query landed into the pool through quarry's ingest pipeline. Shapes
// mirror argus_quarry.archives (ArchiveQuery / SliceSpec).

export interface ArchiveStatus {
  name: string;
  title: string;
  description: string;
  /** QUARRY_<NAME>_DIR is set. */
  configured: boolean;
  /** That directory exists on the quarry host. */
  present: boolean;
  /** `argus-quarry archives index <name>` has been run. */
  indexed: boolean;
  items: number | null;
}

export interface ArchiveListing {
  /** QUARRY_ALLOW_FETCH=1: the server will land slices itself. */
  fetch_allowed: boolean;
  archives: ArchiveStatus[];
}

export async function listArchives(signal?: AbortSignal): Promise<ArchiveListing> {
  const resp = await fetch(`${quarryUrl()}/archives`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export interface FacetCount {
  name: string;
  count: number;
}

export interface ArchiveFacets {
  total: number;
  sized: number;
  n_collections: number;
  collections: FacetCount[];
  licences: FacetCount[];
  mimes: FacetCount[];
  /** Caption-derived tone counts (bw / color); absent on older quarry. */
  tones?: FacetCount[];
  /** Caption-derived medium counts (photo, painting, drawing, print, map, text, object). */
  mediums?: FacetCount[];
  /** Items whose caption mentions a year, and the range of those years. */
  dated?: number;
  year_range?: [number, number] | null;
}

export async function getArchiveFacets(name: string, signal?: AbortSignal): Promise<ArchiveFacets> {
  const resp = await fetch(`${quarryUrl()}/archives/${encodeURIComponent(name)}/facets`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export interface ArchiveQuery {
  /** Caption terms that must all appear; "quoted phrases" stay whole, a leading - excludes. */
  q?: string;
  /** Caption terms none of which may appear (same syntax). */
  exclude?: string;
  collections?: string[];
  licences?: string[];
  mimes?: string[];
  min_width?: number;
  min_height?: number;
  min_short_side?: number;
  orientation?: "landscape" | "portrait" | "square";
  sized_only?: boolean;
  /** Caption-derived; items whose caption doesn't say are excluded. */
  tone?: "bw" | "color";
  mediums?: string[];
  /** A caption-mentioned year in range; undated items never match. */
  year_min?: number;
  year_max?: number;
  ids?: string[];
  sort?: "shuffle" | "largest";
}

export interface ArchiveItem {
  id: string;
  url: string;
  /** A small rendition the browser can load directly (Flickr's 500px), or null. */
  thumb_url: string | null;
  source_url: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  licence: string;
  /** PD12M institution or Flickr owner account. */
  collection: string | null;
  mime: string | null;
  /** Caption-derived cues (null when the caption doesn't say). */
  tone?: "bw" | "color" | null;
  medium?: string | null;
  year?: number | null;
}

export interface ArchivePage {
  total: number;
  offset: number;
  limit: number;
  items: ArchiveItem[];
}

/** The query as the server's GET parameters (lists comma-joined). */
function archiveParams(query: ArchiveQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (query.q?.trim()) p.set("q", query.q.trim());
  if (query.exclude?.trim()) p.set("exclude", query.exclude.trim());
  if (query.collections?.length) p.set("collection", query.collections.join(","));
  if (query.licences?.length) p.set("licence", query.licences.join(","));
  if (query.mimes?.length) p.set("mime", query.mimes.join(","));
  if (query.min_width) p.set("min_width", String(query.min_width));
  if (query.min_height) p.set("min_height", String(query.min_height));
  if (query.min_short_side) p.set("min_short_side", String(query.min_short_side));
  if (query.orientation) p.set("orientation", query.orientation);
  if (query.sized_only) p.set("sized_only", "true");
  if (query.tone) p.set("tone", query.tone);
  if (query.mediums?.length) p.set("medium", query.mediums.join(","));
  if (query.year_min != null) p.set("year_min", String(query.year_min));
  if (query.year_max != null) p.set("year_max", String(query.year_max));
  if (query.ids?.length) p.set("ids", query.ids.join(","));
  if (query.sort) p.set("sort", query.sort);
  return p;
}

export async function searchArchive(
  name: string,
  query: ArchiveQuery,
  page: { limit: number; offset: number },
  signal?: AbortSignal,
): Promise<ArchivePage> {
  const p = archiveParams(query);
  p.set("limit", String(page.limit));
  p.set("offset", String(page.offset));
  const resp = await fetch(`${quarryUrl()}/archives/${encodeURIComponent(name)}/search?${p.toString()}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Thumbnail via quarry: rendered in memory for PD12M, a redirect to Flickr's own small size for Megalith. */
export function archiveThumbUrl(name: string, id: string, size = 384): string {
  return `${quarryUrl()}/archives/${encodeURIComponent(name)}/thumb?id=${encodeURIComponent(id)}&size=${size}`;
}

/** A saved query plus where it lands — what `argus-quarry archives fetch slice.json` runs. */
export interface SliceSpec {
  archive: string;
  query: ArchiveQuery;
  category: string;
  subject: string;
  limit: number;
}

export interface SlicePlan {
  slice: SliceSpec;
  matches: number;
  will_fetch: number;
  command: string;
  fetch_allowed: boolean;
}

export async function planSlice(
  name: string,
  query: ArchiveQuery,
  target: { category: string; subject: string; limit: number },
  signal?: AbortSignal,
): Promise<SlicePlan> {
  const p = archiveParams(query);
  p.set("category", target.category);
  p.set("subject", target.subject);
  p.set("limit", String(target.limit));
  const resp = await fetch(`${quarryUrl()}/archives/${encodeURIComponent(name)}/slice?${p.toString()}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** One NDJSON frame from POST /archives/{name}/fetch. */
export interface SliceFetchFrame {
  type: "start" | "item" | "done" | "error";
  total?: number;
  done?: number;
  status?: "complete" | "skipped" | "duplicate" | "quarantined" | "failed";
  url?: string;
  reason?: string | null;
  message?: string;
  summary?: Record<string, number | boolean>;
}

/**
 * Land a slice in the pool, streaming progress. Rejects on a streamed `error`
 * frame, and with {@link CapabilityRefused} before any request when the host
 * has fetch disabled (the page offers slice.json + the CLI command instead).
 */
export async function fetchSlice(
  spec: SliceSpec,
  onFrame: (frame: SliceFetchFrame) => void,
  signal?: AbortSignal,
): Promise<Record<string, number | boolean>> {
  await requireCapability(
    quarryHealth,
    allowsFetch,
    "This argus-quarry server doesn't land slices itself (QUARRY_ALLOW_FETCH is off); download slice.json and run the CLI command instead.",
    signal,
  );
  const resp = await fetch(`${quarryUrl()}/archives/${encodeURIComponent(spec.archive)}/fetch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
    signal,
  });
  if (!resp.ok) return asError(resp);
  let summary: Record<string, number | boolean> | null = null;
  let streamedError: string | null = null;
  await readNdjson(resp, (obj) => {
    const frame = obj as unknown as SliceFetchFrame;
    onFrame(frame);
    if (frame.type === "done") summary = frame.summary ?? {};
    else if (frame.type === "error") streamedError = frame.message ?? "fetch failed";
  });
  if (streamedError) throw new Error(streamedError);
  if (!summary) throw new Error("Fetch stream ended without a result");
  return summary;
}
