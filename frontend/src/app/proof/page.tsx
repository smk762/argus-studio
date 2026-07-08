"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getProofHealth,
  getReport,
  listReports,
  type EvalReport,
  type ReportSummary,
} from "@/lib/proofApi";
import { DEMO_REPORT, DEMO_SUMMARY } from "@/lib/proofSample";
import { IS_LIVE } from "@/lib/curatorEnv";
import { ProofBoard } from "@/components/proof/ProofBoard";

const NAV = [
  { href: "/", label: "Caption" },
  { href: "/curate", label: "Curate" },
  { href: "/gallery", label: "Gallery" },
  { href: "/proof", label: "Proof" },
];

function verdictDot(s: ReportSummary): string {
  if (s.passed) return "bg-accent-green";
  if (s.pending) return "bg-accent-amber";
  return "bg-accent-red";
}

export default function ProofPage() {
  const [version, setVersion] = useState<string | null>(IS_LIVE ? null : "demo");
  const [unreachable, setUnreachable] = useState(false);
  const [summaries, setSummaries] = useState<ReportSummary[]>(IS_LIVE ? [] : [DEMO_SUMMARY]);
  const [selected, setSelected] = useState<string | null>(IS_LIVE ? null : DEMO_REPORT.run_id);
  const [report, setReport] = useState<EvalReport | null>(IS_LIVE ? null : DEMO_REPORT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live: reachability + the run list. Demo needs no backend.
  useEffect(() => {
    if (!IS_LIVE) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const [health, list] = await Promise.all([getProofHealth(ctrl.signal), listReports(ctrl.signal)]);
        setVersion(health.version);
        setSummaries(list);
        if (list.length > 0) setSelected(list[0].run_id);
      } catch {
        if (!ctrl.signal.aborted) {
          setVersion("");
          setUnreachable(true);
        }
      }
    })();
    return () => ctrl.abort();
  }, []);

  const loadReport = useCallback(async (runId: string) => {
    if (!IS_LIVE) {
      setReport(DEMO_REPORT);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReport(await getReport(runId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) void loadReport(selected);
  }, [selected, loadReport]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <nav className="flex items-center gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={
                    n.href === "/proof"
                      ? "rounded-lg border border-border bg-surface-hover px-3 py-1.5 text-sm text-foreground"
                      : "rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                  }
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent-green/40 bg-accent-green/20">
                <span className="text-sm font-bold text-accent-green">P</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-foreground">Argus Proof</h1>
                <p className="text-xs text-muted">Post-training LoRA evaluation &amp; review</p>
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            {version === null ? (
              <span className="text-[10px] uppercase tracking-wider text-muted/60">…</span>
            ) : version === "" ? (
              <span className="text-[10px] uppercase tracking-wider text-accent-red/80">API unreachable</span>
            ) : version === "demo" ? (
              <span className="rounded-md border border-accent-amber/40 bg-accent-amber/10 px-2 py-1 text-[10px] uppercase tracking-wider text-accent-amber">
                Demo
              </span>
            ) : (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] uppercase tracking-wider text-muted">argus-proof</span>
                <span className="font-mono text-xs text-foreground/90">v{version}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {unreachable ? (
          <div className="mx-auto max-w-xl space-y-4 py-24 text-center">
            <h2 className="text-lg font-medium text-foreground/70">The argus-proof server is not running.</h2>
            <p className="text-sm text-muted">
              Start it with <code className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-xs">argus-proof serve --cors</code>{" "}
              on <span className="font-mono">:8104</span>, or browse the bundled sample in demo mode.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            {/* Run browser */}
            <aside className="space-y-1">
              <div className="mb-2 text-[10px] uppercase tracking-wide text-muted">Runs</div>
              {summaries.length === 0 && <p className="text-sm text-muted">No scored runs yet.</p>}
              {summaries.map((s) => (
                <button
                  key={s.run_id}
                  type="button"
                  onClick={() => setSelected(s.run_id)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                    selected === s.run_id ? "border-accent-purple/60 bg-surface" : "border-border bg-surface/40 hover:bg-surface-hover"
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${verdictDot(s)}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs text-foreground">{s.run_id}</span>
                    <span className="block text-[10px] text-muted">
                      {(s.pass_rate * 100).toFixed(0)}% · {s.n_needs_hitl} to review
                    </span>
                  </span>
                </button>
              ))}
            </aside>

            {/* Selected report */}
            <div>
              {loading && <p className="py-12 text-center text-sm text-muted">Loading report…</p>}
              {error && <p className="py-12 text-center text-sm text-accent-red">{error}</p>}
              {!loading && !error && report && (
                <ProofBoard key={report.run_id} initialReport={report} live={IS_LIVE} />
              )}
              {!loading && !error && !report && summaries.length > 0 && (
                <p className="py-12 text-center text-sm text-muted">Select a run to review.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
