"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ApiVersionBadge } from "@/components/ApiVersionBadge";
import { ScanConfigPanel } from "@/components/curator/ScanConfigPanel";
import { FolderPicker } from "@/components/curator/FolderPicker";
import { ScanSummaryPanel } from "@/components/curator/ScanSummaryPanel";
import { ResultsGrid } from "@/components/curator/ResultsGrid";
import { ClusterReviewLane } from "@/components/curator/ClusterReviewLane";
import { FacetRail } from "@/components/curator/FacetRail";
import { SelectionInsights } from "@/components/curator/SelectionInsights";
import { ExportPanel } from "@/components/curator/ExportPanel";
import { ImageDetailModal } from "@/components/curator/ImageDetailModal";
import { IngestPanel } from "@/components/curator/IngestPanel";
import {
  defaultCuratorConfig,
  defaultFilters,
  matchesFilters,
  type CuratorConfig,
  type CuratorFilters,
  type Detectors,
  type ImageResult,
  type ScanSummary,
} from "@/components/curator/types";
import {
  allowsScanControl,
  allowsScanDelete,
  cancelScan,
  deleteCachedScan,
  getDetectors,
  getHealth,
  getScan,
  isDeterminatePhase,
  listScans,
  purgeScans,
  scanFolderStream,
  scanPhaseLabel,
  StreamCancelled,
  type Health,
  type ScanList,
  type ScanProgress,
} from "@/lib/curatorApi";
import { capabilityReason, permits } from "@/lib/capabilities";
import { canExport, scanCheckedNsfw } from "@/lib/curatorSafety";
import { mergeChunk, pendingCaption, type ScanChunk } from "@/lib/scanChunks";
import { configFromSummary, knownClusterFilters, withoutRelPaths } from "@/lib/scanHistory";
import { curatorUiMode, isLive, localSourcePath } from "@/lib/curatorEnv";
import { useDeepLink } from "@/lib/deepLink";

type View = "grid" | "clusters";

interface ScanHistoryEntry {
  scan_id: string;
  folder: string;
  total: number;
  at: number;
}

const HISTORY_KEY = "argus.curate.scanHistory";
const SCAN_CONTROL_DENIED = "This curator cannot stop or purge a scan (it predates scan control).";
const SCAN_DELETE_DENIED = "This curator cannot delete a cached scan (it predates scan delete).";
const HISTORY_MAX = 8;
/** Stream frames arrive every few images. Every update re-renders the grid, so they land at this pace instead. */
const STREAM_FLUSH_MS = 150;
/** A scan this page is not streaming only reports through `GET /scans`. */
const ACTIVE_SCAN_POLL_MS = 3000;

function loadHistory(): ScanHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as ScanHistoryEntry[];
  } catch {
    return [];
  }
}

/** The default keep-set for a fresh scan: passing, unique representatives. */
function defaultSelection(summary: ScanSummary): Set<string> {
  return new Set(
    summary.results
      .filter((r) => canExport(r) && r.is_representative && !r.is_duplicate)
      .map((r) => r.rel_path),
  );
}

export default function CuratePage() {
  const [config, setConfig] = useState<CuratorConfig>(defaultCuratorConfig());
  const [folderPath, setFolderPath] = useState(() => (isLive() ? localSourcePath() : ""));
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [loading, setLoading] = useState(false);
  // A folder scan is running. `loading` is also true for a cached-scan reload.
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [stopping, setStopping] = useState(false);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // "purge" is in flight, "purged" has landed.
  const stopKind = useRef<"stop" | "purge" | "purged" | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  // Full /health, fetched once here and passed to ExportPanel (which needs
  // allow_move / export_root) so the page makes a single health request.
  const [health, setHealth] = useState<Health | null>(null);

  const [filters, setFilters] = useState<CuratorFilters>(defaultFilters());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>("grid");
  const [detail, setDetail] = useState<ImageResult | null>(null);
  const [detectors, setDetectors] = useState<Detectors | null>(null);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [serverScans, setServerScans] = useState<ScanList | null>(null);
  const [rerunning, setRerunning] = useState<string | null>(null);
  const [forgetting, setForgetting] = useState<string | null>(null);
  const usesServerList = useRef(false);
  const scansRequest = useRef(0);
  // For work that outlives the render it started in, such as an export.
  const scanOnScreen = useRef<string | null>(null);
  const scanId = summary?.scan_id ?? null;
  useEffect(() => {
    scanOnScreen.current = scanId;
  }, [scanId]);

  // Deep link from /gallery: ?folder=<path> preselects the scan folder.
  useDeepLink((params) => {
    if (!isLive()) return;
    const folder = params.get("folder");
    if (folder) setFolderPath(folder);
  });

  const refreshScans = useCallback(async (signal?: AbortSignal) => {
    if (!isLive()) return;
    const request = ++scansRequest.current;
    try {
      const list = await listScans(signal);
      // An older answer must not bring back what a newer one removed.
      if (signal?.aborted || request !== scansRequest.current) return;
      if (list) {
        usesServerList.current = true;
        setServerScans(list);
        return;
      }
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
    }
    if (!usesServerList.current) setHistory(loadHistory());
  }, []);

  // Live extras: detector capabilities, and the curator's scan list when it has one.
  useEffect(() => {
    if (!isLive()) return;
    const ctrl = new AbortController();
    void refreshScans(ctrl.signal);
    getDetectors(ctrl.signal)
      .then(setDetectors)
      .catch(() => setDetectors(null));
    return () => ctrl.abort();
  }, [refreshScans]);

  // The curator keeps a scan running without a browser, so this row has no stream to end it.
  const activeScanId = serverScans?.active?.scan_id ?? null;
  useEffect(() => {
    if (!activeScanId) return;
    const ctrl = new AbortController();
    const timer = setInterval(() => void refreshScans(ctrl.signal), ACTIVE_SCAN_POLL_MS);
    return () => {
      clearInterval(timer);
      ctrl.abort();
    };
  }, [activeScanId, refreshScans]);

  const recordScan = useCallback((data: ScanSummary, folder: string) => {
    if (usesServerList.current) {
      void refreshScans();
      return;
    }
    setHistory((prev) => {
      const next = [
        { scan_id: data.scan_id, folder, total: data.total, at: Date.now() },
        ...prev.filter((h) => h.scan_id !== data.scan_id),
      ].slice(0, HISTORY_MAX);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* storage full/unavailable — history just won't persist */
      }
      return next;
    });
  }, [refreshScans]);

  // Version banner (live) — reachability check.
  useEffect(() => {
    if (!isLive()) {
      setVersion("sample");
      return;
    }
    const ctrl = new AbortController();
    getHealth(ctrl.signal)
      .then((h) => {
        setHealth(h);
        setVersion(h.version);
      })
      .catch(() => setVersion(""));
    return () => ctrl.abort();
  }, []);

  const applySummary = useCallback((data: ScanSummary) => {
    setSummary(data);
    setSelected(defaultSelection(data));
    setFilters(defaultFilters());
    setView("grid");
  }, []);

  // Demo mode: load the bundled read-only sample. Abort on cleanup so React's
  // strict-mode remount starts a fresh fetch; a sticky ref here dropped the
  // first request and never issued the second, so the sample never appeared.
  useEffect(() => {
    if (isLive()) return;
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const resp = await fetch("/curator-sample/scan.json", { signal: ctrl.signal });
        if (!resp.ok) throw new Error(`sample ${resp.status}`);
        applySummary((await resp.json()) as ScanSummary);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load sample");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [applySummary]);

  const clearScan = () => {
    setSummary(null);
    setSelected(new Set());
    setPending([]);
    setDetail(null);
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLive() || !folderPath.trim() || purging) return;
    const prior = { summary, selected, filters, view };
    let sawChunk = false;
    let chunks: ScanChunk[] = [];
    let latestProgress: ScanProgress | null = null;
    let latestPending: string[] | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      const batch = chunks;
      chunks = [];
      if (latestProgress) setProgress(latestProgress);
      if (latestPending) setPending(latestPending);
      if (batch.length > 0) {
        setSummary((current) =>
          batch.reduce<ScanSummary | null>((merged, chunk) => mergeChunk(merged, chunk, config), current),
        );
      }
    };
    const schedule = () => {
      timer ??= setTimeout(flush, STREAM_FLUSH_MS);
    };
    const halt = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };

    stopKind.current = null;
    setError(null);
    setNotice(null);
    setProgress(null);
    clearScan();
    setFilters(defaultFilters());
    setView("grid");
    setLoading(true);
    setScanning(true);
    try {
      const data = await scanFolderStream(
        folderPath.trim(),
        config,
        (update) => {
          latestProgress = update;
          if (update.pending_checks) latestPending = update.pending_checks;
          schedule();
        },
        (chunk) => {
          sawChunk = true;
          // No list on a chunk says nothing about the checks, so the last one stands.
          if (chunk.pending_checks) latestPending = chunk.pending_checks;
          chunks.push(chunk);
          schedule();
        },
      ).finally(halt);
      if (stopKind.current === "purged") {
        // The purge landed first and already deleted this result.
        clearScan();
        return;
      }
      // Filters and the view stay: the user has been working in this grid.
      setPending([]);
      setSummary(data);
      setSelected(defaultSelection(data));
      recordScan(data, folderPath.trim());
    } catch (err) {
      const kind = stopKind.current;
      clearScan();
      if (err instanceof StreamCancelled) {
        if (kind === "purge" || kind === "purged") {
          setNotice("Cached scans were deleted, and the running scan was dropped.");
        } else if (kind === "stop") setNotice("Scan stopped. The partial result was dropped.");
        else setError(err.message);
      } else {
        // A refused scan never replaced the one on screen. A partial one is
        // not a result: its checks did not finish, so it must not reach export.
        if (!sawChunk && !kind) {
          setSummary(prior.summary);
          setSelected(prior.selected);
          setFilters(prior.filters);
          setView(prior.view);
        }
        setError(err instanceof Error ? err.message : "Scan failed");
      }
      // A failed scan can leave its snapshot behind, and a stopped one was listed as running.
      void refreshScans();
    } finally {
      setLoading(false);
      setScanning(false);
      setProgress(null);
      setStopping(false);
      stopKind.current = null;
    }
  };

  const stopScan = async () => {
    const id = summary?.scan_id;
    if (!id || stopping) return;
    stopKind.current = "stop";
    setStopping(true);
    setError(null);
    setNotice(null);
    try {
      await cancelScan(id);
    } catch (err) {
      stopKind.current = null;
      setStopping(false);
      setError(err instanceof Error ? err.message : "Could not stop the scan");
    }
  };

  const purge = async () => {
    if (purging) return;
    if (!window.confirm("Delete every cached scan and stop one if it is running? The source images stay.")) return;
    stopKind.current = "purge";
    setPurging(true);
    setError(null);
    setNotice(null);
    try {
      const { cancelled } = await purgeScans();
      stopKind.current = "purged";
      setHistory([]);
      try {
        localStorage.removeItem(HISTORY_KEY);
      } catch {
        /* ignore */
      }
      clearScan();
      setNotice(cancelled ? "Cached scans were deleted, and the running scan was dropped." : "Cached scans were deleted.");
      void refreshScans();
    } catch (err) {
      // The curator stops the scan before it can refuse (409), so a cancelled
      // frame may still follow, and it should not read as someone else's stop.
      if (stopKind.current === "purge") stopKind.current = scanning ? "stop" : null;
      setError(err instanceof Error ? err.message : "Could not purge the scans");
    } finally {
      setPurging(false);
    }
  };

  /** Reload a cached scan (no rescan). */
  const openCachedScan = async (scanId: string, folder: string) => {
    setError(null);
    setNotice(null);
    setPending([]);
    setLoading(true);
    try {
      applySummary(await getScan(scanId));
      setFolderPath(folder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reload that scan");
      void refreshScans();
    } finally {
      setLoading(false);
    }
  };

  /** Fill the form the way this scan ran. The grid stays as it is. */
  const fillAgain = async (scanId: string) => {
    setRerunning(scanId);
    setError(null);
    try {
      // The settings ride on every page, so one row is enough.
      const data = await getScan(scanId, 1);
      setConfig(configFromSummary(data));
      setFolderPath(data.folder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that scan's settings");
      void refreshScans();
    } finally {
      setRerunning(null);
    }
  };

  const forgetScan = async (scanId: string) => {
    if (!window.confirm("Remove this scan from the curator's cache? The source images stay.")) return;
    setForgetting(scanId);
    setError(null);
    try {
      await deleteCachedScan(scanId);
      if (scanOnScreen.current === scanId) clearScan();
      setNotice("That scan was removed. The source images stayed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that scan");
    } finally {
      setForgetting(null);
      void refreshScans();
    }
  };

  /**
   * A move export has already dropped these rows on the server. Stop showing
   * them. The export outlives the panel, so another scan may be on screen by
   * now, and rel paths mean nothing across scans.
   */
  const dropMoved = (movedScanId: string, moved: string[]) => {
    void refreshScans();
    if (scanOnScreen.current !== movedScanId) return;
    const gone = new Set(moved);
    setSummary((current) => (current ? withoutRelPaths(current, moved) : current));
    setSelected((prev) => new Set([...prev].filter((path) => !gone.has(path))));
    setDetail((current) => (current && gone.has(current.rel_path) ? null : current));
    // A streamed scan is not paged, so a default limit could cut it short here.
    void getScan(movedScanId, summary?.total || undefined)
      .then((fresh) => {
        if (scanOnScreen.current !== movedScanId) return;
        setSummary(fresh);
        setSelected((prev) => {
          const kept = new Set(fresh.results.map((row) => row.rel_path));
          return new Set([...prev].filter((path) => kept.has(path)));
        });
      })
      .catch(() => {
        /* the rows are already gone from the grid */
      });
  };

  const toggle = useCallback((relPath: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) {
        next.delete(relPath);
        return next;
      }
      const img = summary?.results.find((r) => r.rel_path === relPath);
      if (img && !canExport(img)) return prev;
      next.add(relPath);
      return next;
    });
  }, [summary]);

  const filtered = useMemo(
    () => {
      if (!summary) return [];
      const active = knownClusterFilters(filters, summary);
      return summary.results.filter((r) => matchesFilters(r, active));
    },
    [summary, filters],
  );

  const selectedResults = useMemo(
    () => (summary ? summary.results.filter((r) => selected.has(r.rel_path)) : []),
    [summary, selected],
  );

  const selectVisible = () =>
    setSelected((prev) => new Set([...prev, ...filtered.filter(canExport).map((r) => r.rel_path)]));
  const deselectHidden = () =>
    setSelected((prev) => {
      const visible = new Set(filtered.map((r) => r.rel_path));
      return new Set([...prev].filter((relPath) => visible.has(relPath)));
    });
  const clearSelection = () => setSelected(new Set());

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        active="/curate"
        logo={{ letter: "C" }}
        title="Argus Curator"
        subtitle="Curate by quality and by face, then caption with argus-lens"
        badge={
          <ApiVersionBadge
            label="argus-curator"
            version={version}
            className="flex shrink-0 flex-col items-end gap-1"
          >
            <span
              className={`rounded border px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                isLive()
                  ? "border-accent-teal/40 bg-accent-teal/10 text-accent-teal"
                  : "border-accent-purple/40 bg-accent-purple/10 text-accent-purple"
              }`}
              title={
                isLive()
                  ? "ARGUS_CURATOR_UI_MODE=live — real scans against the curator host."
                  : "ARGUS_CURATOR_UI_MODE=demo — read-only bundled sample."
              }
            >
              {isLive() ? "Live" : "Demo sample"}
            </span>
          </ApiVersionBadge>
        }
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            {isLive() ? (
              <>
              <form onSubmit={handleScan} className="space-y-4">
                <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-muted">Image source</span>
                  <p className="text-[11px] leading-relaxed text-muted">
                    Browse the curator&apos;s Docker-mounted folders, or type a path. Sent to{" "}
                    <span className="font-mono text-foreground/80">POST /scan/folder</span>.
                  </p>
                  <FolderPicker onSelect={setFolderPath} selectedAbs={folderPath} />
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Selected folder
                  </label>
                  <input
                    type="text"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    placeholder="/data/images"
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent-teal/50 focus:outline-none focus:ring-2 focus:ring-accent-teal/50"
                  />
                  <button
                    type="submit"
                    disabled={loading || purging || !folderPath.trim()}
                    className="w-full cursor-pointer rounded-lg bg-accent-teal px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-accent-teal/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? "Scanning…" : "Scan folder"}
                  </button>
                  <ScanControlButtons
                    scanning={scanning}
                    scanId={scanId}
                    stopping={stopping}
                    purging={purging}
                    allowed={permits(allowsScanControl(health))}
                    reason={capabilityReason(allowsScanControl(health), SCAN_CONTROL_DENIED)}
                    onStop={() => void stopScan()}
                    onPurge={() => void purge()}
                  />
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  {detectors && <DetectorBadges detectors={detectors} />}
                  <ScanConfigPanel value={config} onChange={setConfig} loading={loading} />
                </div>
              </form>

              <IngestPanel onIngested={setFolderPath} disabled={loading} />

              {serverScans && (
                <CachedScanList
                  list={serverScans}
                  currentId={scanId}
                  canDelete={permits(allowsScanDelete(health))}
                  deleteReason={capabilityReason(allowsScanDelete(health), SCAN_DELETE_DENIED)}
                  busy={loading || purging || forgetting != null}
                  rerunning={rerunning}
                  forgetting={forgetting}
                  onOpen={(scanId, folder) => void openCachedScan(scanId, folder)}
                  onAgain={(scanId) => void fillAgain(scanId)}
                  onDelete={(scanId) => void forgetScan(scanId)}
                />
              )}

              {!serverScans && history.length > 0 && (
                <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">Recent scans</span>
                    <button
                      type="button"
                      onClick={() => {
                        setHistory([]);
                        try {
                          localStorage.removeItem(HISTORY_KEY);
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="cursor-pointer text-[10px] text-muted underline decoration-dotted hover:text-foreground"
                    >
                      clear
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {history.map((h) => (
                      <li key={h.scan_id}>
                        <button
                          type="button"
                          onClick={() => void openCachedScan(h.scan_id, h.folder)}
                          disabled={loading}
                          title={`${h.folder} — reload without rescanning`}
                          className="w-full cursor-pointer rounded-lg border border-border bg-background px-2.5 py-1.5 text-left transition-colors hover:border-accent-teal/40 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <span className="block truncate font-mono text-[11px] text-foreground/90">{h.folder}</span>
                          <span className="block text-[10px] text-muted">
                            {h.total} images · {new Date(h.at).toLocaleString()}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              </>
            ) : (
              <div className="space-y-2 rounded-xl border border-accent-purple/30 bg-accent-purple/5 p-4">
                <span className="block text-xs font-semibold uppercase tracking-wider text-accent-purple">Demo sample</span>
                <p className="text-[11px] leading-relaxed text-muted">
                  A pre-computed scan (2 identities, a near-duplicate pair, some rejects). Explore the facets, cluster
                  review, and manifest export read-only. Set{" "}
                  <span className="font-mono text-foreground/80">ARGUS_CURATOR_UI_MODE=live</span> to run real
                  scans.
                </p>
              </div>
            )}

            {summary && (
              <>
                <FacetRail
                  summary={summary}
                  filters={filters}
                  onChange={setFilters}
                  visibleCount={filtered.length}
                  pending={pending}
                />
                <SelectionInsights summary={summary} selectedResults={selectedResults} />
                {scanning ? (
                  <p className="rounded-xl border border-border bg-surface p-4 text-[11px] leading-relaxed text-muted">
                    Export opens when the scan finishes. The keep-set is chosen then.
                  </p>
                ) : (
                  <ExportPanel
                    key={summary.scan_id}
                    summary={summary}
                    selectedResults={selectedResults}
                    health={health}
                    onMoved={dropMoved}
                  />
                )}
              </>
            )}
          </aside>

          <div className="min-w-0 space-y-6">
            {notice && (
              <div className="rounded-lg border border-border bg-surface p-4 text-sm text-foreground">{notice}</div>
            )}

            {error && (
              <div className="rounded-lg border border-accent-red/30 bg-accent-red/5 p-4 text-sm text-accent-red">{error}</div>
            )}

            {summary && (
              <>
                {scanning && <ScanProgressView progress={progress} pending={pending} compact />}
                <ScanSummaryPanel summary={summary} />

                <div className="rounded-xl border border-border bg-surface p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                      <TabButton active={view === "grid"} onClick={() => setView("grid")}>
                        Results ({filtered.length})
                      </TabButton>
                      <TabButton active={view === "clusters"} onClick={() => setView("clusters")}>
                        Cluster review ({summary.similar_clusters})
                      </TabButton>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">{selected.size} selected</span>
                      <button
                        type="button"
                        onClick={selectVisible}
                        className="cursor-pointer rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                      >
                        Select visible
                      </button>
                      <button
                        type="button"
                        onClick={deselectHidden}
                        className="cursor-pointer rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                      >
                        Deselect hidden
                      </button>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="cursor-pointer rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {view === "grid" ? (
                    <ResultsGrid
                      scanId={summary.scan_id}
                      nsfwRan={scanCheckedNsfw(summary)}
                      pending={pending}
                      results={filtered}
                      selected={selected}
                      onToggle={toggle}
                      onOpen={setDetail}
                    />
                  ) : (
                    <ClusterReviewLane
                      scanId={summary.scan_id}
                      nsfwRan={scanCheckedNsfw(summary)}
                      pending={pending}
                      results={summary.results}
                      selected={selected}
                      onToggle={toggle}
                    />
                  )}
                </div>
              </>
            )}

            {!summary && loading && <ScanProgressView progress={progress} pending={pending} />}

            {!summary && !loading && !error && (
              <div className="py-24 text-center text-muted">
                <p className="text-lg text-foreground/60">Enter a folder path and scan to begin.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <SiteFooter
        poweredBy={
          <>
            <a
              href="https://github.com/smk762/argus-curator"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-teal transition-colors hover:text-accent-teal/80"
            >
              argus-curator
            </a>{" "}
            · mode: {curatorUiMode()}
          </>
        }
        right="MIT License"
      />

      <ImageDetailModal
        scanId={summary?.scan_id ?? ""}
        nsfwRan={summary ? scanCheckedNsfw(summary) : false}
        pending={pending}
        img={detail ? (summary?.results.find((row) => row.rel_path === detail.rel_path) ?? detail) : null}
        list={filtered}
        selected={detail ? selected.has(detail.rel_path) : false}
        onToggle={toggle}
        onNavigate={setDetail}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}

function CachedScanList({
  list,
  currentId,
  canDelete,
  deleteReason,
  busy,
  rerunning,
  forgetting,
  onOpen,
  onAgain,
  onDelete,
}: {
  list: ScanList;
  currentId: string | null;
  canDelete: boolean;
  deleteReason: string | null;
  busy: boolean;
  rerunning: string | null;
  forgetting: string | null;
  onOpen: (scanId: string, folder: string) => void;
  onAgain: (scanId: string) => void;
  onDelete: (scanId: string) => void;
}) {
  const active = list.active;
  const rows = list.scans.filter((scan) => scan.scan_id !== active?.scan_id);
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
      <span className="block text-xs font-semibold uppercase tracking-wider text-muted">Cached scans</span>
      {!active && rows.length === 0 && <p className="text-[11px] text-muted">No cached scans.</p>}
      {active && (
        <div className="rounded-lg border border-accent-teal/30 bg-accent-teal/5 px-2.5 py-1.5">
          <span className="block truncate font-mono text-[11px] text-foreground/90" title={active.folder}>
            {active.folder}
          </span>
          <span className="block text-[10px] text-accent-teal">
            {active.cancelling ? "Stopping" : "In progress"} · {scanPhaseLabel(active.phase)}
            {active.total > 0 ? ` · ${active.done}/${active.total}` : ""}
          </span>
        </div>
      )}
      <ul className="space-y-1">
        {rows.map((scan) => (
          <li key={scan.scan_id} className="flex items-stretch gap-1">
            <button
              type="button"
              onClick={() => onOpen(scan.scan_id, scan.folder)}
              disabled={busy}
              title={`${scan.folder} — reload without rescanning`}
              className={`min-w-0 flex-1 cursor-pointer rounded-lg border bg-background px-2.5 py-1.5 text-left transition-colors hover:border-accent-teal/40 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 ${
                currentId === scan.scan_id ? "border-accent-teal/50" : "border-border"
              }`}
            >
              <span className="block truncate font-mono text-[11px] text-foreground/90">{scan.folder}</span>
              <span className="block text-[10px] text-muted">
                {scan.total} images · {new Date(scan.updated_at).toLocaleString()}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onAgain(scan.scan_id)}
              disabled={rerunning != null || busy}
              title="Fill the form the way this scan ran"
              className="cursor-pointer rounded-lg border border-border px-2 text-[10px] text-muted hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {rerunning === scan.scan_id ? "…" : "Again"}
            </button>
            <button
              type="button"
              onClick={() => onDelete(scan.scan_id)}
              disabled={!canDelete || busy}
              title={canDelete ? "Remove this scan from the cache. Source images stay." : (deleteReason ?? SCAN_DELETE_DENIED)}
              className="cursor-pointer rounded-lg border border-border px-2 text-[10px] text-accent-red hover:bg-accent-red/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {forgetting === scan.scan_id ? "…" : "Delete"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScanProgressView({
  progress,
  pending,
  compact = false,
}: {
  progress: ScanProgress | null;
  pending: readonly string[];
  compact?: boolean;
}) {
  const label = progress ? scanPhaseLabel(progress.phase) : "Starting scan";
  const hasCount = !!progress && isDeterminatePhase(progress.phase) && progress.total > 0;
  const pct = hasCount ? Math.round((progress!.done / progress!.total) * 100) : null;
  const waiting = pending.length > 0 ? pendingCaption(pending) : null;

  return (
    <div className={`flex flex-col items-center justify-center gap-5 ${compact ? "rounded-xl border border-border bg-surface px-5 py-4" : "py-32"}`}>
      {!compact && <div className="h-12 w-12 animate-spin rounded-full border-2 border-accent-teal/30 border-t-accent-teal" />}
      <div className="w-full max-w-sm space-y-2 text-center">
        <p className="text-sm font-medium text-foreground">{label}…</p>
        {hasCount ? (
          <>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
              <div
                className="h-full rounded-full bg-accent-teal transition-all duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="font-mono text-xs text-muted">
              {progress!.done.toLocaleString()} / {progress!.total.toLocaleString()} ({pct}%)
            </p>
          </>
        ) : (
          <p className="text-xs text-muted">{compact ? "Reading the folder…" : "This can take a moment for large folders…"}</p>
        )}
        {waiting && <p className="text-xs text-accent-teal">Still checking {waiting}</p>}
      </div>
    </div>
  );
}

function ScanControlButtons({
  scanning,
  scanId,
  stopping,
  purging,
  allowed,
  reason,
  onStop,
  onPurge,
}: {
  scanning: boolean;
  scanId: string | null;
  stopping: boolean;
  purging: boolean;
  allowed: boolean;
  reason: string | null;
  onStop: () => void;
  onPurge: () => void;
}) {
  const stopTitle = !allowed
    ? (reason ?? SCAN_CONTROL_DENIED)
    : !scanning
      ? "Stop is available while a scan is running."
      : !scanId
        ? "Stop is available once the first images arrive."
        : "Stop the running scan. Checks already in flight finish, and the partial scan is dropped.";
  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={!allowed || !scanning || !scanId || stopping || purging}
        title={stopTitle}
        onClick={onStop}
        className="flex-1 cursor-pointer rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {stopping ? "Stopping…" : "Stop"}
      </button>
      <button
        type="button"
        disabled={!allowed || purging}
        title={allowed ? "Stop a running scan and delete every cached scan. Source images stay." : (reason ?? SCAN_CONTROL_DENIED)}
        onClick={onPurge}
        className="flex-1 cursor-pointer rounded-lg border border-accent-red/40 px-3 py-2 text-sm text-accent-red transition-colors hover:bg-accent-red/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {purging ? "Purging…" : "Purge"}
      </button>
    </div>
  );
}

const DETECTOR_INFO: { key: keyof Detectors; label: string; hint: string }[] = [
  { key: "torch", label: "torch", hint: "PyTorch — required for CLIP embeddings and GPU scoring" },
  { key: "cuda", label: "cuda", hint: "NVIDIA GPU acceleration (falls back to CPU when off)" },
  { key: "clip", label: "clip", hint: "CLIP embeddings — powers the diversity weighting" },
  { key: "insightface", label: "faces", hint: "InsightFace — face detection, pose buckets, identity clustering" },
  { key: "onnxruntime", label: "onnx", hint: "ONNX runtime for the face models" },
];

/** What the curator backend can actually do (GET /detectors) — explains greyed-out options. */
function DetectorBadges({ detectors }: { detectors: Detectors }) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5 border-b border-border pb-3">
      {DETECTOR_INFO.map(({ key, label, hint }) => (
        <span
          key={key}
          title={`${hint} — ${detectors[key] ? "available" : "not installed on the curator"}`}
          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${
            detectors[key]
              ? "border-accent-green/40 bg-accent-green/10 text-accent-green"
              : "border-border bg-background text-muted line-through"
          }`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "border border-accent-teal/40 bg-accent-teal/20 text-accent-teal" : "border border-border bg-surface text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
