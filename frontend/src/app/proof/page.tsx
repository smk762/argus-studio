"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getProofHealth,
  getReport,
  listReports,
  type EvalReport,
  type ReportSummary,
} from "@/lib/proofApi";
import { DEMO_REPORT, DEMO_SUMMARY } from "@/lib/proofSample";
import { isLive } from "@/lib/curatorEnv";
import { SiteHeader } from "@/components/SiteHeader";
import { ApiVersionBadge } from "@/components/ApiVersionBadge";
import { ProofBoard } from "@/components/proof/ProofBoard";
import { NewEvaluation } from "@/components/proof/NewEvaluation";

function verdictDot(s: ReportSummary): string {
  if (s.passed) return "bg-accent-green";
  if (s.pending) return "bg-accent-amber";
  return "bg-accent-red";
}

export default function ProofPage() {
  // version: null = loading, "" = unreachable, "demo", or a real version string.
  const [version, setVersion] = useState<string | null>(isLive() ? null : "demo");
  const [summaries, setSummaries] = useState<ReportSummary[]>(isLive() ? [] : [DEMO_SUMMARY]);
  const [selected, setSelected] = useState<string | null>(isLive() ? null : DEMO_REPORT.run_id);
  const [report, setReport] = useState<EvalReport | null>(isLive() ? null : DEMO_REPORT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unreachable = version === "";

  // Live: reachability + the run list. Demo needs no backend.
  useEffect(() => {
    if (!isLive()) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const [health, list] = await Promise.all([getProofHealth(ctrl.signal), listReports(ctrl.signal)]);
        setVersion(health.version);
        setSummaries(list);
        if (list.length > 0) setSelected(list[0].run_id);
      } catch {
        if (!ctrl.signal.aborted) setVersion("");
      }
    })();
    return () => ctrl.abort();
  }, []);

  // Load the selected run's report, aborting a slower in-flight fetch so a quick
  // run switch can't land an earlier response over the current selection.
  const loadReport = useCallback(async (runId: string, signal?: AbortSignal) => {
    if (!isLive()) {
      setReport(DEMO_REPORT);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReport(await getReport(runId, signal));
    } catch (err) {
      if (signal?.aborted) return; // superseded by a newer selection
      setError(err instanceof Error ? err.message : "Failed to load report");
      setReport(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    const ctrl = new AbortController();
    void loadReport(selected, ctrl.signal);
    return () => ctrl.abort();
  }, [selected, loadReport]);

  // A finished evaluation run: refresh the run browser and land on the new
  // scored report for HITL review.
  const onRunComplete = useCallback(async (runId: string) => {
    try {
      setSummaries(await listReports());
    } catch {
      // the list refresh is best-effort; the report itself still loads below
    }
    setSelected(runId);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        active="/proof"
        logo={{ letter: "P", tone: "green" }}
        title="Argus Proof"
        subtitle="Post-training LoRA evaluation & review"
        badge={
          version === "demo" ? (
            <div className="shrink-0 text-right">
              <span className="rounded-md border border-accent-amber/40 bg-accent-amber/10 px-2 py-1 text-[10px] uppercase tracking-wider text-accent-amber">
                Demo
              </span>
            </div>
          ) : (
            <ApiVersionBadge label="argus-proof" version={version} prefix="v" />
          )
        }
      />

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
          <div className="space-y-6">
            {isLive() && <NewEvaluation onComplete={onRunComplete} />}
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
                <ProofBoard key={report.run_id} initialReport={report} live={isLive()} />
              )}
              {!loading && !error && !report && summaries.length > 0 && (
                <p className="py-12 text-center text-sm text-muted">Select a run to review.</p>
              )}
            </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
