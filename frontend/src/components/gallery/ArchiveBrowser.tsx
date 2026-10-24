"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  archiveThumbUrl,
  fetchSlice,
  getArchiveFacets,
  listArchives,
  planSlice,
  searchArchive,
  type ArchiveFacets,
  type ArchiveItem,
  type ArchiveListing,
  type ArchiveQuery,
  type SliceFetchFrame,
  type SlicePlan,
} from "@/lib/galleryApi";
import { downloadText } from "@/lib/download";
import { CapabilityNotice } from "@/components/CapabilityNotice";

const PAGE_SIZE = 48;
const CATEGORIES = ["identity", "wardrobe", "setting", "concept"] as const;
const MIN_SIZES = [0, 512, 768, 1024, 1536] as const;
/** Explicit selections travel as an `ids=` query parameter, so keep them URL-sized. */
const SELECTION_MAX = 200;

const selectClass =
  "cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-accent-amber/50 focus:outline-none";
const inputClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted/60 focus:border-accent-amber/50 focus:outline-none";

interface Form {
  q: string;
  exclude: string;
  collection: string;
  licence: string;
  minShort: number;
  orientation: "" | "landscape" | "portrait" | "square";
  sizedOnly: boolean;
  tone: "" | "bw" | "color";
  medium: string;
  yearMin: string;
  yearMax: string;
  sort: "shuffle" | "largest";
}

const EMPTY_FORM: Form = { q: "", exclude: "", collection: "", licence: "", minShort: 0, orientation: "", sizedOnly: false, tone: "", medium: "", yearMin: "", yearMax: "", sort: "shuffle" };

const MEDIUM_LABELS: Record<string, string> = {
  photo: "photograph",
  painting: "painting",
  drawing: "drawing / illustration",
  print: "print / engraving",
  map: "map",
  text: "text / document",
  object: "object / sculpture",
};

function year(v: string): number | undefined {
  const n = Number(v.trim());
  return v.trim() !== "" && Number.isInteger(n) ? n : undefined;
}

function toQuery(f: Form): ArchiveQuery {
  return {
    q: f.q || undefined,
    exclude: f.exclude || undefined,
    collections: f.collection ? [f.collection] : undefined,
    licences: f.licence ? [f.licence] : undefined,
    min_short_side: f.minShort || undefined,
    orientation: f.orientation || undefined,
    sized_only: f.sizedOnly || undefined,
    tone: f.tone || undefined,
    mediums: f.medium ? [f.medium] : undefined,
    year_min: year(f.yearMin),
    year_max: year(f.yearMax),
    sort: f.sort,
  };
}

/**
 * Browse, filter and slice the public-domain metadata archives quarry indexes
 * (PD12M, Megalith-10m). Nothing here is downloaded until a slice is landed:
 * the grid shows thumbnails straight from the archive's own hosting.
 *
 * Landing a slice goes through quarry's ingest pipeline (licence gate, SHA256
 * dedup, provenance DB). When the host has `QUARRY_ALLOW_FETCH=1` the server
 * does it and streams progress; otherwise (the demo-safe default) the page
 * hands over the `slice.json` and the CLI command that lands it.
 */
export function ArchiveBrowser({ onLanded }: { onLanded?: () => void }) {
  const [listing, setListing] = useState<ArchiveListing | null>(null);
  const [archive, setArchive] = useState<string>("");
  const [facets, setFacets] = useState<ArchiveFacets | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [query, setQuery] = useState<ArchiveQuery>(toQuery(EMPTY_FORM));
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<ArchiveItem | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const l = await listArchives(ctrl.signal);
        setListing(l);
        // PD12M first when it's ready: per-image licence + institution make it the structured set.
        const first =
          l.archives.find((a) => a.indexed && a.name === "pd12m") ?? l.archives.find((a) => a.indexed) ?? l.archives[0];
        if (first) setArchive(first.name);
      } catch (err) {
        if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : "Failed to list archives");
      }
    })();
    return () => ctrl.abort();
  }, []);

  const current = listing?.archives.find((a) => a.name === archive);
  const ready = Boolean(current?.indexed);

  // Facets + a clean form whenever the archive changes.
  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    (async () => {
      setForm(EMPTY_FORM);
      setQuery(toQuery(EMPTY_FORM));
      setSelected(new Set());
      try {
        setFacets(await getArchiveFacets(archive, ctrl.signal));
      } catch {
        if (!ctrl.signal.aborted) setFacets(null);
      }
    })();
    return () => ctrl.abort();
  }, [archive, ready]);

  const load = useCallback(
    async (offset: number, append: boolean, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const page = await searchArchive(archive, query, { limit: PAGE_SIZE, offset }, signal);
        setTotal(page.total);
        setItems((cur) => (append ? [...cur, ...page.items] : page.items));
      } catch (err) {
        if (signal?.aborted) return;
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [archive, query],
  );

  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    (async () => {
      await load(0, false, ctrl.signal);
    })();
    return () => ctrl.abort();
  }, [load, ready]);

  const apply = (next: Partial<Form>, immediate = true) => {
    const merged = { ...form, ...next };
    setForm(merged);
    if (immediate) {
      setQuery(toQuery(merged));
      setSelected(new Set());
    }
  };

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else if (next.size < SELECTION_MAX) next.add(id);
      return next;
    });

  if (!listing) {
    return error ? <ErrorBox message={error} /> : <p className="py-12 text-center text-sm text-muted">Loading archives…</p>;
  }

  return (
    <div className="space-y-5">
      {/* Archive picker */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border bg-surface p-1">
          {listing.archives.map((a) => (
            <button
              key={a.name}
              type="button"
              onClick={() => setArchive(a.name)}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                archive === a.name ? "bg-accent-amber text-black" : "text-muted hover:text-foreground"
              }`}
            >
              {a.title}
              {a.items != null && <span className="ml-1.5 font-mono opacity-70">{compact(a.items)}</span>}
            </button>
          ))}
        </div>
        {current && <p className="min-w-0 flex-1 text-xs text-muted">{current.description}</p>}
      </div>

      {current && !ready && <NotReady archive={current.name} configured={current.configured} present={current.present} />}

      {ready && (
        <>
          {/* Filters */}
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              apply({});
            }}
          >
            <input
              value={form.q}
              onChange={(e) => apply({ q: e.target.value }, false)}
              placeholder='must mention, e.g. harbor boats or "red dress"'
              title='All terms must appear in the caption. "Quoted phrases" stay whole; -term excludes. Captions use US spelling.'
              className={`${inputClass} w-72`}
            />
            <input
              value={form.exclude}
              onChange={(e) => apply({ exclude: e.target.value }, false)}
              placeholder="must not mention, e.g. painting drawing"
              title="None of these terms may appear in the caption. Uncaptioned items are kept."
              aria-label="exclude caption terms"
              className={`${inputClass} w-60 border-accent-red/30 focus:border-accent-red/60`}
            />
            <button
              type="submit"
              className="cursor-pointer rounded-lg border border-accent-amber/40 bg-accent-amber/10 px-3 py-2 text-xs font-medium text-accent-amber hover:bg-accent-amber/20"
            >
              Search
            </button>
            {facets && (
              <select value={form.collection} onChange={(e) => apply({ collection: e.target.value })} className={`${selectClass} max-w-56`}>
                <option value="">
                  {archive === "megalith" ? "All Flickr accounts" : "All institutions"} ({facets.n_collections.toLocaleString()})
                </option>
                {facets.collections.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.count.toLocaleString()})
                  </option>
                ))}
              </select>
            )}
            {facets && facets.licences.length > 1 && (
              <select value={form.licence} onChange={(e) => apply({ licence: e.target.value })} className={selectClass}>
                <option value="">All licences</option>
                {facets.licences.map((l) => (
                  <option key={l.name} value={l.name}>
                    {l.name} ({l.count.toLocaleString()})
                  </option>
                ))}
              </select>
            )}
            <select value={form.minShort} onChange={(e) => apply({ minShort: Number(e.target.value) })} className={selectClass}>
              {MIN_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s ? `short side ≥ ${s}px` : "any size"}
                </option>
              ))}
            </select>
            <select
              value={form.orientation}
              onChange={(e) => apply({ orientation: e.target.value as Form["orientation"] })}
              className={selectClass}
            >
              <option value="">any shape</option>
              <option value="landscape">landscape</option>
              <option value="portrait">portrait</option>
              <option value="square">square</option>
            </select>
            {facets && facets.sized < facets.total && (
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={form.sizedOnly} onChange={(e) => apply({ sizedOnly: e.target.checked })} />
                known size only
              </label>
            )}
            {facets?.tones && facets.tones.length > 0 && (
              <select
                value={form.tone}
                onChange={(e) => apply({ tone: e.target.value as Form["tone"] })}
                title="Read from the caption; images whose caption doesn't say are left out when set"
                className={selectClass}
              >
                <option value="">any tone</option>
                {facets.tones.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name === "bw" ? "black & white" : "colour"} ({t.count.toLocaleString()})
                  </option>
                ))}
              </select>
            )}
            {facets?.mediums && facets.mediums.length > 1 && (
              <select
                value={form.medium}
                onChange={(e) => apply({ medium: e.target.value })}
                title="Read from the caption's opening words, e.g. 'The image shows a painting of…'"
                className={selectClass}
              >
                <option value="">any medium</option>
                {facets.mediums.map((m) => (
                  <option key={m.name} value={m.name}>
                    {MEDIUM_LABELS[m.name] ?? m.name} ({m.count.toLocaleString()})
                  </option>
                ))}
              </select>
            )}
            {facets?.dated ? (
              <span
                className="flex items-center gap-1 text-xs text-muted"
                title={`Only ${facets.dated.toLocaleString()} captions mention a year; a range matches only those.`}
              >
                year
                <input
                  value={form.yearMin}
                  onChange={(e) => apply({ yearMin: e.target.value }, false)}
                  onBlur={() => apply({})}
                  placeholder={String(facets.year_range?.[0] ?? "from")}
                  inputMode="numeric"
                  aria-label="year from"
                  className={`${inputClass} w-20`}
                />
                –
                <input
                  value={form.yearMax}
                  onChange={(e) => apply({ yearMax: e.target.value }, false)}
                  onBlur={() => apply({})}
                  placeholder={String(facets.year_range?.[1] ?? "to")}
                  inputMode="numeric"
                  aria-label="year to"
                  className={`${inputClass} w-20`}
                />
                <span className="text-[10px] text-muted/70">({compact(facets.dated)} dated)</span>
              </span>
            ) : null}
            <select value={form.sort} onChange={(e) => apply({ sort: e.target.value as Form["sort"] })} className={selectClass}>
              <option value="shuffle">shuffled</option>
              <option value="largest">largest first</option>
            </select>
            <span className="text-xs text-muted">{total.toLocaleString()} match{total === 1 ? "" : "es"}</span>
          </form>

          {error && <ErrorBox message={error} />}

          {/* Grid */}
          {items.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {items.map((it) => {
                const on = selected.has(it.id);
                return (
                  <div
                    key={it.id}
                    className={`group relative overflow-hidden rounded-lg border bg-surface transition-colors ${
                      on ? "border-accent-amber" : "border-border hover:border-accent-amber/50"
                    }`}
                  >
                    <button type="button" onClick={() => setDetail(it)} className="block w-full cursor-pointer text-left">
                      {/* eslint-disable-next-line @next/next/no-img-element -- archive-hosted thumbnails, not Next assets */}
                      <img
                        src={archiveThumbUrl(archive, it.id, 320)}
                        alt={it.caption ?? it.id}
                        loading="lazy"
                        className="aspect-square w-full bg-background object-cover"
                      />
                      <div className="space-y-0.5 p-2">
                        <span className="line-clamp-2 text-[11px] leading-snug text-foreground/85">{it.caption ?? "—"}</span>
                        <span className="block truncate font-mono text-[10px] text-muted">
                          {it.width ? `${it.width}×${it.height}` : "size ?"} · {it.collection}
                        </span>
                      </div>
                    </button>
                    <label
                      className={`absolute top-1.5 left-1.5 flex cursor-pointer items-center rounded bg-black/60 p-1 ${
                        on ? "" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                      }`}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggle(it.id)} aria-label={`select ${it.id}`} />
                    </label>
                  </div>
                );
              })}
            </div>
          )}

          {items.length < total && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => void load(items.length, true)}
                disabled={loading}
                className="cursor-pointer rounded-lg border border-border bg-surface px-5 py-2.5 text-sm text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "Loading…" : `Load more (${items.length.toLocaleString()} of ${total.toLocaleString()})`}
              </button>
            </div>
          )}
          {!loading && items.length === 0 && !error && (
            <p className="py-16 text-center text-sm text-muted">No matches; loosen the filters.</p>
          )}

          <SliceBar
            archive={archive}
            query={query}
            total={total}
            selected={[...selected]}
            fetchAllowed={listing.fetch_allowed}
            onClearSelection={() => setSelected(new Set())}
            onLanded={onLanded}
          />
        </>
      )}

      {detail && <ItemDetail archive={archive} item={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/** Target + action for a slice: the whole match set, or just the ticked items. */
function SliceBar({
  archive,
  query,
  total,
  selected,
  fetchAllowed,
  onClearSelection,
  onLanded,
}: {
  archive: string;
  query: ArchiveQuery;
  total: number;
  selected: string[];
  fetchAllowed: boolean;
  onClearSelection: () => void;
  onLanded?: () => void;
}) {
  const [category, setCategory] = useState<string>("setting");
  const [subject, setSubject] = useState("");
  const [limit, setLimit] = useState("100");
  const [plan, setPlan] = useState<SlicePlan | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; counts: Record<string, number> } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  useEffect(() => () => ctrlRef.current?.abort(), []);

  const useSelection = selected.length > 0;
  const sliceQuery = useMemo<ArchiveQuery>(() => (useSelection ? { ...query, ids: selected } : query), [query, selected, useSelection]);
  const n = useSelection ? selected.length : Math.min(total, Number(limit) || 0);
  const ready = subject.trim() !== "" && n > 0;

  const target = () => ({
    category,
    subject: subject.trim(),
    limit: useSelection ? selected.length : Math.max(1, Math.min(Number(limit) || 100, 5000)),
  });

  const save = async () => {
    setError(null);
    try {
      const p = await planSlice(archive, sliceQuery, target());
      setPlan(p);
      downloadText("slice.json", JSON.stringify(p.slice, null, 2) + "\n", "application/json");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not plan the slice");
    }
  };

  const land = async () => {
    setError(null);
    setResult(null);
    setRunning(true);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const p = await planSlice(archive, sliceQuery, target(), ctrl.signal);
      const counts: Record<string, number> = {};
      setProgress({ done: 0, total: p.will_fetch, counts });
      const summary = await fetchSlice(
        p.slice,
        (f: SliceFetchFrame) => {
          if (f.type === "item" && f.status) {
            counts[f.status] = (counts[f.status] ?? 0) + 1;
            setProgress({ done: f.done ?? 0, total: f.total ?? p.will_fetch, counts: { ...counts } });
          }
        },
        ctrl.signal,
      );
      setResult(
        `Landed ${summary.complete ?? 0} in ${p.slice.category}/${p.slice.subject}` +
          ` (skipped ${summary.skipped ?? 0}, duplicate ${summary.duplicate ?? 0}, failed ${summary.failed ?? 0})` +
          (summary.budget_reached ? " — pool budget reached, rerun after raising QUARRY_MAX_GB" : ""),
      );
      onClearSelection();
      onLanded?.();
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      if (!ctrl.signal.aborted) setRunning(false);
      if (ctrlRef.current === ctrl) ctrlRef.current = null;
    }
  };

  return (
    <section className="sticky bottom-3 z-10 space-y-3 rounded-xl border border-accent-amber/30 bg-surface/95 px-5 py-4 shadow-lg backdrop-blur-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="text-xs">
          <div className="text-[10px] uppercase tracking-wide text-muted">Slice</div>
          <div className="font-medium text-foreground">
            {useSelection ? (
              <>
                {selected.length} selected{" "}
                <button type="button" onClick={onClearSelection} className="cursor-pointer text-muted underline hover:text-foreground">
                  clear
                </button>
              </>
            ) : (
              <>first {n.toLocaleString()} of {total.toLocaleString()} matches</>
            )}
          </div>
        </div>
        <label className="space-y-1 text-[10px] uppercase tracking-wide text-muted">
          <span className="block">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[10px] uppercase tracking-wide text-muted">
          <span className="block">Subject folder</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Harbor_views" className={`${inputClass} w-44`} />
        </label>
        {!useSelection && (
          <label className="space-y-1 text-[10px] uppercase tracking-wide text-muted">
            <span className="block">Max images</span>
            <input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="numeric" className={`${inputClass} w-24`} />
          </label>
        )}
        {fetchAllowed ? (
          <button
            type="button"
            onClick={land}
            disabled={!ready || running}
            className="cursor-pointer rounded-lg bg-accent-amber px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? "Fetching…" : `Fetch ${n.toLocaleString()} into the pool`}
          </button>
        ) : (
          <button
            type="button"
            onClick={save}
            disabled={!ready}
            className="cursor-pointer rounded-lg border border-accent-amber/50 bg-accent-amber/10 px-4 py-2 text-sm font-medium text-accent-amber hover:bg-accent-amber/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download slice.json
          </button>
        )}
      </div>

      {!fetchAllowed && (
        <CapabilityNotice
          reason={
            plan ? (
              <>
                Saved <span className="font-mono">slice.json</span> ({plan.will_fetch.toLocaleString()} image
                {plan.will_fetch === 1 ? "" : "s"}). Land it on the quarry host with{" "}
                <span className="font-mono">{plan.command}</span>.
              </>
            ) : (
              <>
                This quarry server doesn&apos;t fetch slices itself (set <span className="font-mono">QUARRY_ALLOW_FETCH=1</span>{" "}
                to enable). Download the slice and run <span className="font-mono">argus-quarry archives fetch slice.json</span>{" "}
                on the quarry host instead.
              </>
            )
          }
        />
      )}

      {progress && running && (
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full bg-accent-amber transition-all duration-300"
              style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
            {progress.done} / {progress.total}
            {Object.entries(progress.counts).map(([k, v]) => ` · ${k} ${v}`)}
          </span>
        </div>
      )}
      {result && <p className="text-xs text-accent-green">{result}</p>}
      {error && <p className="text-xs text-accent-red">{error}</p>}
    </section>
  );
}

function ItemDetail({ archive, item, onClose }: { archive: string; item: ArchiveItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="grid max-h-[85vh] w-full max-w-3xl grid-cols-1 overflow-y-auto rounded-xl border border-border bg-surface sm:grid-cols-[minmax(0,1fr)_280px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- archive-hosted image, not a Next asset */}
        <img src={archiveThumbUrl(archive, item.id, 1024)} alt={item.caption ?? item.id} className="max-h-[85vh] w-full bg-background object-contain" />
        <div className="space-y-3 p-4 text-xs">
          <p className="leading-relaxed text-foreground/90">{item.caption ?? "No caption."}</p>
          <dl className="space-y-1.5">
            <Row label="Licence" value={item.licence} />
            {item.collection && <Row label={archive === "megalith" ? "Flickr user" : "Institution"} value={item.collection} />}
            <Row label="Size" value={item.width ? `${item.width}×${item.height}` : "unknown"} />
            {item.mime && <Row label="Type" value={item.mime} />}
            {(item.medium || item.tone || item.year) && (
              <Row
                label="From caption"
                value={[
                  item.medium && (MEDIUM_LABELS[item.medium] ?? item.medium),
                  item.tone && (item.tone === "bw" ? "black & white" : "colour"),
                  item.year && String(item.year),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            )}
            <Row label="ID" value={item.id} mono />
          </dl>
          <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="block truncate text-accent-amber hover:text-accent-amber/80">
            View source ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className={`min-w-0 break-all ${mono ? "font-mono text-foreground/80" : "text-foreground/90"}`}>{value}</dd>
    </div>
  );
}

function NotReady({ archive, configured, present }: { archive: string; configured: boolean; present: boolean }) {
  const env = `QUARRY_${archive.toUpperCase()}_DIR`;
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface px-5 py-4 text-sm text-muted">
      {!configured ? (
        <p>
          Not configured on this quarry server. Archive the metadata with{" "}
          <span className="font-mono text-foreground/80">scripts/fetch_public_domain_metadata.py</span>, point{" "}
          <span className="font-mono text-foreground/80">{env}</span> at it, then build the index.
        </p>
      ) : !present ? (
        <p>
          <span className="font-mono text-foreground/80">{env}</span> is set, but that directory isn&apos;t visible to the quarry
          server. Is the share mounted into the container?
        </p>
      ) : (
        <p>Archived but not indexed yet.</p>
      )}
      <p>
        Build the search index once on the quarry host:{" "}
        <span className="font-mono text-foreground/80">argus-quarry archives index {archive}</span>
      </p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-lg border border-accent-red/30 bg-accent-red/5 p-4 text-sm text-accent-red">{message}</div>;
}

function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
}
