"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Modal } from "@/components/Modal";
import { SiteHeader } from "@/components/SiteHeader";
import { StageHandoff } from "@/components/StageHandoff";
import { SiteFooter } from "@/components/SiteFooter";
import { ApiVersionBadge } from "@/components/ApiVersionBadge";
import { ArchiveBrowser } from "@/components/gallery/ArchiveBrowser";
import {
  externalUrl,
  getQuarryHealth,
  getQuarryPhoto,
  getQuarryReadiness,
  getQuarryStats,
  listQuarryPhotos,
  listQuarrySubjects,
  parsePhotoId,
  quarryThumbUrl,
  type QuarryPhoto,
  type QuarryReadiness,
  type QuarryStats,
  type QuarrySubject,
} from "@/lib/galleryApi";
import { localSourcePath } from "@/lib/curatorEnv";
import { joinPath } from "@/lib/path";
import { replaceQuery, useDeepLink } from "@/lib/deepLink";
import { REPO_URL, STATIC_DEMO } from "@/lib/staticDemo";
import { ExternalLink } from "@/components/ExternalLink";

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
  return localSourcePath() ? joinPath(localSourcePath(), rel) : rel;
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
  // The open photo. `seed` is its grid row, shown while GET /photos/{id} answers;
  // a `?photo=` link has none.
  const [detail, setDetail] = useState<{ id: number; seed: QuarryPhoto | null } | null>(null);
  // null until /ready has answered.
  const [readiness, setReadiness] = useState<QuarryReadiness | null>(null);
  const [checking, setChecking] = useState(false);
  // "pool" = what quarry has acquired; "sources" = the public-domain archives it can slice from.
  // `?view=sources` deep-links to the archive browser.
  const [view, setView] = useState<"pool" | "sources">("pool");
  useDeepLink((params) => {
    if (params.get("view") === "sources") setView("sources");
    const photo = parsePhotoId(params.get("photo"));
    if (photo !== null) setDetail({ id: photo, seed: null });
  });
  const [poolVersion, setPoolVersion] = useState(0);
  // Only quarry's own "not ready" stops the pool routes. On `unknown` they still
  // run, so a quarry without /ready behaves as it always has.
  const serveable = readiness !== null && readiness !== "not_ready";

  const openPhoto = (photo: QuarryPhoto) => {
    setDetail({ id: photo.id, seed: photo });
    replaceQuery({ photo: String(photo.id) });
  };
  const closePhoto = () => {
    setDetail(null);
    replaceQuery({ photo: null });
  };

  // Reachability + stats (re-read after a slice lands in the pool).
  useEffect(() => {
    if (STATIC_DEMO) return; // nothing to reach; the page explains instead
    const ctrl = new AbortController();
    (async () => {
      // allSettled: only a failed /health means "not running". An empty or
      // still-seeding pool 503s /stats, and that must not hide the Sources view,
      // which is how a fresh pool gets filled in the first place.
      const [health, ready, s] = await Promise.allSettled([
        getQuarryHealth(ctrl.signal),
        getQuarryReadiness(ctrl.signal),
        getQuarryStats(ctrl.signal),
      ]);
      if (ctrl.signal.aborted) return;
      setChecking(false);
      if (health.status === "fulfilled") {
        const state = ready.status === "fulfilled" ? ready.value : "unknown";
        setVersion(health.value.version);
        setReadiness(state);
        setStats(s.status === "fulfilled" ? s.value : null);
        if (state === "not_ready") setLoading(false);
      } else {
        setVersion("");
        setUnreachable(true);
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [poolVersion]);

  // Subject list follows the category filter.
  useEffect(() => {
    if (STATIC_DEMO || !serveable) return;
    const ctrl = new AbortController();
    listQuarrySubjects(filters.category || undefined, ctrl.signal)
      .then(setSubjects)
      .catch(() => setSubjects([]));
    return () => ctrl.abort();
  }, [filters.category, serveable, poolVersion]);

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
    if (STATIC_DEMO || !serveable) return;
    void loadPage(0, false);
  }, [loadPage, serveable, poolVersion]);

  const setFilter = (key: keyof Filters, value: string) =>
    setFilters((cur) => ({ ...cur, [key]: value, ...(key === "category" ? { subject: "" } : {}) }));

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        active="/gallery"
        logo={{ letter: "Q" }}
        title="Argus Quarry"
        subtitle="Provenance-first PD/CC0 acquisition pool"
        badge={
          STATIC_DEMO ? (
            <div className="shrink-0 text-right">
              <span className="rounded-md border border-accent-amber/40 bg-accent-amber/10 px-2 py-1 text-[10px] uppercase tracking-wider text-accent-amber">
                Not in demo
              </span>
            </div>
          ) : (
            <ApiVersionBadge label="argus-quarry" version={version} prefix="v" />
          )
        }
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {STATIC_DEMO ? (
          <div className="mx-auto max-w-2xl space-y-5 py-16 text-center">
            <h2 className="text-lg font-medium text-foreground/80">The gallery browses a live acquisition pool.</h2>
            <p className="text-sm leading-relaxed text-muted">
              argus-quarry fetches public-domain and CC0 photographs from open archives, records the source, licence
              and attribution of every file, and publishes them as curator-ready{" "}
              <span className="font-mono text-foreground/80">&lt;category&gt;/&lt;subject&gt;/</span> folders. This
              page is a read-only view of that provenance database, so there is nothing to show without one: this
              static demo does not bundle a pool of third-party photographs.
            </p>
            <p className="text-sm leading-relaxed text-muted">
              Run it yourself with <span className="font-mono text-foreground/80">docker compose --profile gallery up</span>,
              or continue to the next stage, which ships with a sample scan.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <StageHandoff href="/curate" label="Explore the curator sample" />
              <ExternalLink href={REPO_URL} className="text-accent-teal hover:underline">
                Run it yourself
              </ExternalLink>
            </div>
          </div>
        ) : unreachable ? (
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
            <div className="inline-flex rounded-lg border border-border bg-surface p-1">
              <FilterChip active={view === "pool"} onClick={() => setView("pool")}>
                Pool
              </FilterChip>
              <FilterChip active={view === "sources"} onClick={() => setView("sources")}>
                Sources · PD12M / Megalith
              </FilterChip>
            </div>

            {view === "sources" ? (
              <ArchiveBrowser onLanded={() => setPoolVersion((v) => v + 1)} />
            ) : readiness === "not_ready" ? (
              <PoolNotReady
                checking={checking}
                onSources={() => setView("sources")}
                onCheck={() => {
                  setChecking(true);
                  setPoolVersion((v) => v + 1);
                }}
              />
            ) : (
            <>
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
                    onClick={() => openPhoto(p)}
                    className="group cursor-pointer overflow-hidden rounded-lg border border-border bg-surface text-left transition-colors hover:border-accent-amber/50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={quarryThumbUrl(p.id)}
                      alt={p.title ?? p.subject}
                      loading="lazy"
                      className="aspect-square w-full object-cover transition-transform motion-safe:group-hover:scale-[1.02]"
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
                  to fill the pool, slice one from <b>Sources</b>, or loosen the filters.
                </p>
              </div>
            )}
            </>
            )}
          </div>
        )}
      </main>

      <SiteFooter
        poweredBy={
          <>
            <ExternalLink
              href="https://github.com/smk762/argus-quarry"
              className="text-accent-amber transition-colors hover:text-accent-amber/80"
            >
              argus-quarry
            </ExternalLink>{" "}
            · provenance + public-domain archives
          </>
        }
        right="Images: PD / CC0 as recorded per item"
      />

      {detail && !unreachable && <PhotoDetail key={detail.id} id={detail.id} seed={detail.seed} onClose={closePhoto} />}
    </div>
  );
}

/** Quarry is up but `/ready` says it can't serve a pool. Sources stays open: it's how a new pool gets filled. */
function PoolNotReady({ checking, onSources, onCheck }: { checking: boolean; onSources: () => void; onCheck: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-20 text-center">
      <h2 className="text-lg font-medium text-foreground/70">The pool is empty or not ready.</h2>
      <p className="text-sm leading-relaxed text-muted">
        Quarry is running, but it has no provenance database to serve yet. A new pool stays like this until its first
        acquisition: run <span className="font-mono text-foreground/80">docker compose --profile gallery up</span>, or
        slice one from <b>Sources</b>.
      </p>
      <p className="text-sm leading-relaxed text-muted">
        If this pool has photos, check that <span className="font-mono text-foreground/80">QUARRY_HOME</span> is mounted.
        Quarry reports a missing, unmigrated or unreadable database the same way.
      </p>
      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={onSources}
          className="cursor-pointer rounded-lg bg-accent-amber px-4 py-2 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
        >
          Browse Sources
        </button>
        <button
          type="button"
          onClick={onCheck}
          disabled={checking}
          className="cursor-pointer rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {checking ? "Checking…" : "Check again"}
        </button>
      </div>
    </div>
  );
}

/**
 * One photograph's provenance, from `GET /photos/{id}`. The grid row shows at
 * once when there is one. A failed read keeps it on screen and says so.
 */
function PhotoDetail({ id, seed, onClose }: { id: number; seed: QuarryPhoto | null; onClose: () => void }) {
  const [photo, setPhoto] = useState<QuarryPhoto | null>(seed);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    getQuarryPhoto(id, ctrl.signal)
      .then(setPhoto)
      .catch((err) => {
        if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : "Failed to load photo");
      });
    return () => ctrl.abort();
  }, [id]);

  const titleId = useId();
  const sourceUrl = externalUrl(photo?.source_url);
  const originalUrl = externalUrl(photo?.remote_url);

  return (
    <Modal labelledBy={titleId} className="max-w-3xl" onClose={onClose}>
      <h2 id={titleId} className="sr-only">
        {photo?.title ?? photo?.filename ?? `Photo ${id}`}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_280px]">
        {photo?.filename && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={quarryThumbUrl(id, 1024)}
            alt={photo.title ?? photo.subject}
            onError={() => setImageFailed(true)}
            className="max-h-[85vh] w-full object-contain bg-background"
          />
        ) : (
          <div className="flex min-h-64 items-center justify-center bg-background p-6 text-center text-xs text-muted">
            {!photo ? (error ? "Nothing to show." : "Loading…") : "No pooled file for this record."}
          </div>
        )}
        <div className="space-y-3 p-4 text-sm">
          {error && (
            <p className="text-xs text-accent-red">
              {photo ? `Showing the grid's copy. Couldn't reload this record: ${error}` : error}
            </p>
          )}
          {photo && (
            <>
              <div>
                <h3 className="font-medium text-foreground">{photo.title ?? photo.filename ?? `Photo ${photo.id}`}</h3>
                <p className="font-mono text-xs text-muted">
                  {photo.category}/{photo.subject}
                </p>
              </div>
              <dl className="space-y-1.5 text-xs">
                <ProvRow label="Licence" value={photo.licence} highlight />
                {photo.status !== "complete" && <ProvRow label="Status" value={photo.status} />}
                <ProvRow label="Source" value={photo.source} />
                {photo.photographer && <ProvRow label="Photographer" value={photo.photographer} />}
                {photo.year && <ProvRow label="Year" value={String(photo.year)} />}
                {photo.attribution && <ProvRow label="Attribution" value={photo.attribution} />}
                {photo.width && photo.height && <ProvRow label="Dimensions" value={`${photo.width}×${photo.height}`} />}
                {photo.file_size && <ProvRow label="Size" value={formatBytes(photo.file_size)} />}
                {photo.filename && <ProvRow label="File" value={photo.filename} mono />}
                {photo.sha256 && <ProvRow label="SHA256" value={photo.sha256} mono />}
                {photo.downloaded_at && <ProvRow label="Acquired" value={photo.downloaded_at} />}
                <ProvRow label="ID" value={String(photo.id)} mono />
              </dl>
              <div className="space-y-2 pt-1">
                {sourceUrl && (
                  <ExternalLink
                    href={sourceUrl}
                    className="block truncate text-xs text-accent-amber hover:text-accent-amber/80"
                  >
                    View source page ↗
                  </ExternalLink>
                )}
                {originalUrl && (
                  <ExternalLink
                    href={originalUrl}
                    className="block truncate text-xs text-accent-amber hover:text-accent-amber/80"
                  >
                    Original file ↗
                  </ExternalLink>
                )}
                {photo.status === "complete" && (
                  <StageHandoff
                    href={`/curate?folder=${encodeURIComponent(curateFolderFor(photo))}`}
                    className="block w-full text-center"
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
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
        active ? "bg-accent-amber text-on-accent" : "text-muted hover:text-foreground"
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
