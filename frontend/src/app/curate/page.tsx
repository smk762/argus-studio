"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { getDetectors, getHealth, getScan, scanFolderStream, type ScanProgress } from "@/lib/curatorApi";
import { CURATOR_UI_MODE, IS_LIVE, LOCAL_SOURCE_PATH } from "@/lib/curatorEnv";

type View = "grid" | "clusters";

interface ScanHistoryEntry {
  scan_id: string;
  folder: string;
  total: number;
  at: number;
}

const HISTORY_KEY = "argus.curate.scanHistory";
const HISTORY_MAX = 8;

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
    summary.results.filter((r) => r.passed && r.is_representative && !r.is_duplicate).map((r) => r.rel_path),
  );
}

export default function CuratePage() {
  const [config, setConfig] = useState<CuratorConfig>(defaultCuratorConfig());
  const [folderPath, setFolderPath] = useState(() => (IS_LIVE ? LOCAL_SOURCE_PATH : ""));
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  const [filters, setFilters] = useState<CuratorFilters>(defaultFilters());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>("grid");
  const [detail, setDetail] = useState<ImageResult | null>(null);
  const [detectors, setDetectors] = useState<Detectors | null>(null);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);

  const loadedSample = useRef(false);

  // Live extras: detector capabilities + recent-scan history (localStorage).
  useEffect(() => {
    if (!IS_LIVE) return;
    setHistory(loadHistory());
    const ctrl = new AbortController();
    getDetectors(ctrl.signal)
      .then(setDetectors)
      .catch(() => setDetectors(null));
    return () => ctrl.abort();
  }, []);

  const recordScan = useCallback((data: ScanSummary, folder: string) => {
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
  }, []);

  // Version banner (live) — reachability check.
  useEffect(() => {
    if (!IS_LIVE) {
      setVersion("sample");
      return;
    }
    const ctrl = new AbortController();
    getHealth(ctrl.signal)
      .then((h) => setVersion(h.version))
      .catch(() => setVersion(""));
    return () => ctrl.abort();
  }, []);

  const applySummary = useCallback((data: ScanSummary) => {
    setSummary(data);
    setSelected(defaultSelection(data));
    setFilters(defaultFilters());
    setView("grid");
  }, []);

  // Demo mode: load the bundled read-only sample once.
  useEffect(() => {
    if (IS_LIVE || loadedSample.current) return;
    loadedSample.current = true;
    (async () => {
      setLoading(true);
      try {
        const resp = await fetch("/curator-sample/scan.json");
        if (!resp.ok) throw new Error(`sample ${resp.status}`);
        applySummary((await resp.json()) as ScanSummary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load sample");
      } finally {
        setLoading(false);
      }
    })();
  }, [applySummary]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!IS_LIVE || !folderPath.trim()) return;
    setError(null);
    setProgress(null);
    setLoading(true);
    try {
      const data = await scanFolderStream(folderPath.trim(), config, setProgress);
      applySummary(data);
      recordScan(data, folderPath.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  /** Reload a persisted scan from the history rail (no rescan). */
  const openHistoryScan = async (entry: ScanHistoryEntry) => {
    setError(null);
    setLoading(true);
    try {
      applySummary(await getScan(entry.scan_id));
      setFolderPath(entry.folder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reload scan (it may have been evicted)");
    } finally {
      setLoading(false);
    }
  };

  const toggle = useCallback((relPath: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) next.delete(relPath);
      else next.add(relPath);
      return next;
    });
  }, []);

  const filtered = useMemo(
    () => (summary ? summary.results.filter((r) => matchesFilters(r, filters)) : []),
    [summary, filters],
  );

  const selectedResults = useMemo(
    () => (summary ? summary.results.filter((r) => selected.has(r.rel_path)) : []),
    [summary, selected],
  );

  const selectVisible = () => setSelected((prev) => new Set([...prev, ...filtered.map((r) => r.rel_path)]));
  const clearSelection = () => setSelected(new Set());

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <nav className="flex items-center gap-1">
              <Link href="/" className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground">
                Caption
              </Link>
              <Link href="/curate" className="rounded-lg border border-border bg-surface-hover px-3 py-1.5 text-sm text-foreground">
                Curate
              </Link>
            </nav>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent-teal/40 bg-accent-teal/20">
                <span className="text-sm font-bold text-accent-teal">C</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-foreground">Argus Curator</h1>
                <p className="text-xs text-muted">Curate by quality and by face, then caption with argus-lens</p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={`rounded border px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                IS_LIVE
                  ? "border-accent-teal/40 bg-accent-teal/10 text-accent-teal"
                  : "border-accent-purple/40 bg-accent-purple/10 text-accent-purple"
              }`}
              title={
                IS_LIVE
                  ? "NEXT_PUBLIC_CURATOR_UI_MODE=live — real scans against the curator host."
                  : "NEXT_PUBLIC_CURATOR_UI_MODE=demo — read-only bundled sample."
              }
            >
              {IS_LIVE ? "Live" : "Demo sample"}
            </span>
            {version === null ? (
              <span className="text-[10px] uppercase tracking-wider text-muted/60">…</span>
            ) : version === "" ? (
              <span className="text-[10px] uppercase tracking-wider text-accent-red/80">API unreachable</span>
            ) : (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] uppercase tracking-wider text-muted">argus-curator</span>
                <span className="font-mono text-xs text-foreground/90">{version}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            {IS_LIVE ? (
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
                    disabled={loading || !folderPath.trim()}
                    className="w-full cursor-pointer rounded-lg bg-accent-teal px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-accent-teal/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? "Scanning…" : "Scan folder"}
                  </button>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  {detectors && <DetectorBadges detectors={detectors} />}
                  <ScanConfigPanel value={config} onChange={setConfig} loading={loading} />
                </div>
              </form>

              <IngestPanel onIngested={setFolderPath} disabled={loading} />

              {history.length > 0 && (
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
                          onClick={() => void openHistoryScan(h)}
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
                  <span className="font-mono text-foreground/80">NEXT_PUBLIC_CURATOR_UI_MODE=live</span> to run real
                  scans.
                </p>
              </div>
            )}

            {summary && (
              <>
                <FacetRail summary={summary} filters={filters} onChange={setFilters} visibleCount={filtered.length} />
                <SelectionInsights summary={summary} selectedResults={selectedResults} />
                <ExportPanel summary={summary} selectedResults={selectedResults} />
              </>
            )}
          </aside>

          <div className="min-w-0 space-y-6">
            {error && (
              <div className="rounded-lg border border-accent-red/30 bg-accent-red/5 p-4 text-sm text-accent-red">{error}</div>
            )}

            {summary && (
              <>
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
                        onClick={clearSelection}
                        className="cursor-pointer rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {view === "grid" ? (
                    <ResultsGrid scanId={summary.scan_id} results={filtered} selected={selected} onToggle={toggle} onOpen={setDetail} />
                  ) : (
                    <ClusterReviewLane scanId={summary.scan_id} results={summary.results} selected={selected} onToggle={toggle} />
                  )}
                </div>
              </>
            )}

            {!summary && loading && <ScanProgressView progress={progress} />}

            {!summary && !loading && !error && (
              <div className="py-24 text-center text-muted">
                <p className="text-lg text-foreground/60">Enter a folder path and scan to begin.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-border py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-xs text-muted sm:px-6">
          <span>
            Powered by{" "}
            <a
              href="https://github.com/smk762/argus-curator"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-teal transition-colors hover:text-accent-teal/80"
            >
              argus-curator
            </a>{" "}
            · mode: {CURATOR_UI_MODE}
          </span>
          <span>MIT License</span>
        </div>
      </footer>

      <ImageDetailModal
        scanId={summary?.scan_id ?? ""}
        img={detail}
        list={filtered}
        selected={detail ? selected.has(detail.rel_path) : false}
        onToggle={toggle}
        onNavigate={setDetail}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}

const PHASE_LABELS: Record<ScanProgress["phase"], string> = {
  collecting: "Reading images from disk",
  scoring: "Scoring images",
  faces: "Detecting & clustering faces",
  clustering: "Grouping near-duplicates",
};

// Phases that report a meaningful running count (determinate bar). The others
// (collecting / near-duplicate clustering) are quick and shown as pending.
const DETERMINATE_PHASES: ScanProgress["phase"][] = ["scoring", "faces"];

function ScanProgressView({ progress }: { progress: ScanProgress | null }) {
  const label = progress ? PHASE_LABELS[progress.phase] : "Starting scan";
  const hasCount = !!progress && DETERMINATE_PHASES.includes(progress.phase) && progress.total > 0;
  const pct = hasCount ? Math.round((progress!.done / progress!.total) * 100) : null;

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-32">
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-accent-teal/30 border-t-accent-teal" />
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
          <p className="text-xs text-muted">This can take a moment for large folders…</p>
        )}
      </div>
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
