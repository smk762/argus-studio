"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getQuarryHealth,
  getQuarryStats,
  listQuarryPhotos,
  listQuarrySubjects,
  quarryThumbUrl,
  type QuarryPhoto,
  type QuarryStats,
  type QuarrySubject,
} from "@/lib/galleryApi";
import { LOCAL_SOURCE_PATH } from "@/lib/curatorEnv";

const PAGE_SIZE = 60;
const CATEGORIES = ["identity", "wardrobe", "setting", "concept"] as const;

interface Filters {
  category: string;
  subject: string;
  licence: string;
  source: string;
}

const NO_FILTERS: Filters = { category: "", subject: "", licence: "", source: "" };

/** Dataset path (as the curator sees it) where quarry publishes this photo's subject. */
function curateFolderFor(photo: QuarryPhoto): string {
  const rel = `${photo.category}/${photo.subject}`;
  if (!LOCAL_SOURCE_PATH) return rel;
  return `${LOCAL_SOURCE_PATH.replace(/\/+$/, "")}/${rel}`;
}

function formatBytes(n: number): string {
  if (n >= 1 << 30) return `${(n / (1 << 30)).toFixed(1)} GB`;
  if (n >= 1 << 20) return `${(n / (1 << 20)).toFixed(1)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

export default function GalleryPage() {
  const [version, setVersion] = useState<string | null>(null);
  const [stats, setStats] = useState<QuarryStats | null>(null);
  const [subjects, setSubjects] = useState<QuarrySubject[]>([]);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [photos, setPhotos] = useState<QuarryPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<QuarryPhoto | null>(null);

  // Reachability + stats.
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const [health, s] = await Promise.all([getQuarryHealth(ctrl.signal), getQuarryStats(ctrl.signal)]);
        setVersion(health.version);
        setStats(s);
      } catch {
        if (!ctrl.signal.aborted) {
          setVersion("");
          setUnreachable(true);
          setLoading(false);
        }
      }
    })();
    return () => ctrl.abort();
  }, []);

  // Subject list follows the category filter.
  useEffect(() => {
    if (unreachable) return;
    const ctrl = new AbortController();
    listQuarrySubjects(filters.category || undefined, ctrl.signal)
      .then(setSubjects)
      .catch(() => setSubjects([]));
    return () => ctrl.abort();
  }, [filters.category, unreachable]);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const page = await listQuarryPhotos({
          category: filters.category || undefined,
          subject: filters.subject || undefined,
          licence: filters.licence || undefined,
          source: filters.source || undefined,
          limit: PAGE_SIZE,
          offset,
        });
        setTotal(page.total);
        setPhotos((cur) => (append ? [...cur, ...page.photos] : page.photos));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load photos");
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  // Reload the grid whenever filters change.
  useEffect(() => {
    if (unreachable) return;
    void loadPage(0, false);
  }, [loadPage, unreachable]);

  const setFilter = (key: keyof Filters, value: string) =>
    setFilters((cur) => ({ ...cur, [key]: value, ...(key === "category" ? { subject: "" } : {}) }));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <nav className="flex items-center gap-1">
              <Link href="/" className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground">
                Caption
              </Link>
              <Link href="/curate" className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground">
                Curate
              </Link>
              <Link href="/gallery" className="rounded-lg border border-border bg-surface-hover px-3 py-1.5 text-sm text-foreground">
                Gallery
              </Link>
              <Link href="/proof" className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground">
                Proof
              </Link>
            </nav>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent-amber/40 bg-accent-amber/20">
                <span className="text-sm font-bold text-accent-amber">Q</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-foreground">Argus Quarry</h1>
                <p className="text-xs text-muted">Provenance-first PD/CC0 acquisition pool</p>
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            {version === null ? (
              <span className="text-[10px] uppercase tracking-wider text-muted/60">…</span>
            ) : version === "" ? (
              <span className="text-[10px] uppercase tracking-wider text-accent-red/80">API unreachable</span>
            ) : (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] uppercase tracking-wider text-muted">argus-quarry</span>
                <span className="font-mono text-xs text-foreground/90">v{version}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {unreachable ? (
          <div className="mx-auto max-w-xl space-y-4 py-24 text-center">
            <h2 className="text-lg font-medium text-foreground/70">The quarry provenance server is not running.</h2>
            <p className="text-sm leading-relaxed text-muted">
              Start it with the suite (<span className="font-mono text-foreground/80">docker compose --profile gallery up</span>)
              or directly:{" "}
              <span className="font-mono text-foreground/80">pip install &quot;argus-quarry[server]&quot; &amp;&amp; argus-quarry serve --cors --port 8102</span>.
              It serves read-only provenance for everything quarry has acquired — subjects, licences, sources, and
              per-image attribution.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats strip */}
            {stats && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-surface px-5 py-4">
                <Stat value={stats.photographs.toLocaleString()} label="photographs" />
                <Stat value={stats.subjects.toLocaleString()} label="subjects" />
                <Stat value={formatBytes(stats.total_bytes)} label="pool size" />
                <div className="ml-auto flex flex-wrap gap-1.5">
                  {Object.entries(stats.by_licence).map(([lic, n]) => (
                    <span
                      key={lic}
                      className="rounded border border-accent-amber/40 bg-accent-amber/10 px-1.5 py-0.5 font-mono text-[10px] text-accent-amber"
                    >
                      {lic} · {n}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-lg border border-border bg-surface p-1">
                <FilterChip active={filters.category === ""} onClick={() => setFilter("category", "")}>
                  All
                </FilterChip>
                {CATEGORIES.map((c) => (
                  <FilterChip key={c} active={filters.category === c} onClick={() => setFilter("category", c)}>
                    {c}
                  </FilterChip>
                ))}
              </div>
              <select
                value={filters.subject}
                onChange={(e) => setFilter("subject", e.target.value)}
                className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-accent-amber/50 focus:outline-none"
              >
                <option value="">All subjects</option>
                {subjects.map((s) => (
                  <option key={`${s.category}/${s.folder}`} value={s.folder}>
                    {s.folder} ({s.photo_count})
                  </option>
                ))}
              </select>
              {stats && (
                <select
                  value={filters.source}
                  onChange={(e) => setFilter("source", e.target.value)}
                  className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-accent-amber/50 focus:outline-none"
                >
                  <option value="">All sources</option>
                  {Object.keys(stats.by_source).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
              {stats && (
                <select
                  value={filters.licence}
                  onChange={(e) => setFilter("licence", e.target.value)}
                  className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-accent-amber/50 focus:outline-none"
                >
                  <option value="">All licences</option>
                  {Object.keys(stats.by_licence).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
              <span className="text-xs text-muted">
                {total.toLocaleString()} photo{total === 1 ? "" : "s"}
              </span>
            </div>

            {error && (
              <div className="rounded-lg border border-accent-red/30 bg-accent-red/5 p-4 text-sm text-accent-red">{error}</div>
            )}

            {/* Grid */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDetail(p)}
                    className="group cursor-pointer overflow-hidden rounded-lg border border-border bg-surface text-left transition-colors hover:border-accent-amber/50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={quarryThumbUrl(p.id)}
                      alt={p.title ?? p.subject}
                      loading="lazy"
                      className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                    <div className="space-y-0.5 p-2">
                      <span className="block truncate text-xs font-medium text-foreground/90">{p.title ?? p.filename}</span>
                      <span className="block truncate font-mono text-[10px] text-muted">
                        {p.subject} · {p.licence}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {photos.length < total && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => void loadPage(photos.length, true)}
                  disabled={loading}
                  className="cursor-pointer rounded-lg border border-border bg-surface px-5 py-2.5 text-sm text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Loading…" : `Load more (${photos.length} of ${total})`}
                </button>
              </div>
            )}

            {!loading && photos.length === 0 && !error && (
              <div className="py-24 text-center text-muted">
                <p className="text-lg text-foreground/60">Nothing here yet.</p>
                <p className="mt-2 text-sm">
                  Run an acquisition (<span className="font-mono text-foreground/80">docker compose --profile gallery up</span>)
                  to fill the pool, or loosen the filters.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-border py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-xs text-muted sm:px-6">
          <span>
            Powered by{" "}
            <a
              href="https://github.com/smk762/argus-quarry"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-amber transition-colors hover:text-accent-amber/80"
            >
              argus-quarry
            </a>{" "}
            · read-only provenance
          </span>
          <span>Images: PD / CC0 as recorded per item</span>
        </div>
      </footer>

      {/* Provenance detail */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="grid max-h-[85vh] w-full max-w-3xl grid-cols-1 overflow-y-auto rounded-xl border border-border bg-surface sm:grid-cols-[minmax(0,1fr)_280px]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={quarryThumbUrl(detail.id, 1024)}
              alt={detail.title ?? detail.subject}
              className="max-h-[85vh] w-full object-contain bg-background"
            />
            <div className="space-y-3 p-4 text-sm">
              <div>
                <h3 className="font-medium text-foreground">{detail.title ?? detail.filename}</h3>
                <p className="font-mono text-xs text-muted">
                  {detail.category}/{detail.subject}
                </p>
              </div>
              <dl className="space-y-1.5 text-xs">
                <ProvRow label="Licence" value={detail.licence} highlight />
                <ProvRow label="Source" value={detail.source} />
                {detail.photographer && <ProvRow label="Photographer" value={detail.photographer} />}
                {detail.year && <ProvRow label="Year" value={String(detail.year)} />}
                {detail.attribution && <ProvRow label="Attribution" value={detail.attribution} />}
                {detail.width && detail.height && <ProvRow label="Dimensions" value={`${detail.width}×${detail.height}`} />}
                {detail.file_size && <ProvRow label="Size" value={formatBytes(detail.file_size)} />}
                {detail.sha256 && <ProvRow label="SHA256" value={detail.sha256} mono />}
                {detail.downloaded_at && <ProvRow label="Acquired" value={detail.downloaded_at} />}
              </dl>
              <div className="space-y-2 pt-1">
                <a
                  href={detail.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs text-accent-amber hover:text-accent-amber/80"
                >
                  View source page ↗
                </a>
                <Link
                  href={`/curate?folder=${encodeURIComponent(curateFolderFor(detail))}`}
                  className="block w-full rounded-lg bg-accent-teal/20 px-4 py-2 text-center text-xs font-semibold text-accent-teal transition-colors hover:bg-accent-teal/30"
                >
                  Curate this subject →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-lg font-bold tabular-nums text-foreground">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-accent-amber text-black" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ProvRow({ label, value, mono = false, highlight = false }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd
        className={`min-w-0 break-all ${
          highlight ? "font-semibold text-accent-amber" : mono ? "font-mono text-foreground/80" : "text-foreground/90"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
