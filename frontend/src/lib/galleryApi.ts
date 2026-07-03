/** Thin client for the argus-quarry read-only provenance API (:8102). */

export const QUARRY_URL = process.env.NEXT_PUBLIC_QUARRY_URL ?? "http://localhost:8102";

async function asError(resp: Response): Promise<never> {
  const detail = await resp.json().catch(() => null);
  throw new Error(detail?.detail ?? `Server error: ${resp.status}`);
}

export interface QuarryHealth {
  status: string;
  service: string;
  version: string;
  quarry_home: string;
}

export async function getQuarryHealth(signal?: AbortSignal): Promise<QuarryHealth> {
  const resp = await fetch(`${QUARRY_URL}/health`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
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
  const resp = await fetch(`${QUARRY_URL}/stats`, { signal });
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
  const resp = await fetch(`${QUARRY_URL}/subjects?${params.toString()}`, { signal });
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
  const resp = await fetch(`${QUARRY_URL}/photos?${params.toString()}`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** Build a /thumb URL for a pooled photograph. */
export function quarryThumbUrl(id: number, size = 384): string {
  return `${QUARRY_URL}/thumb?id=${id}&size=${size}`;
}
