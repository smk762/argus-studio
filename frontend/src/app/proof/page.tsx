"use client";

import { useCallback, useEffect, useState } from "react";
import {
  allowsEval,
  allowsPurge,
  getProofHealth,
  getReport,
  getReportManifest,
  servesReportManifest,
  listReports,
  withReportSummary,
  type EvalReport,
  type ProofHealth,
  type ReportManifest,
  type ReportSummary,
} from "@/lib/proofApi";
import { permits, type Capability } from "@/lib/capabilities";
import { DEMO_REPORT, DEMO_SUMMARY } from "@/lib/proofSample";
import { proofLive } from "@/lib/curatorEnv";
import { REPO_URL, STATIC_DEMO } from "@/lib/staticDemo";
import { DemoBadge } from "@/components/DemoChrome";
import { SiteHeader } from "@/components/SiteHeader";
import { ApiVersionBadge } from "@/components/ApiVersionBadge";
import { ProofBoard } from "@/components/proof/ProofBoard";
import { NewEvaluation } from "@/components/proof/NewEvaluation";
import { StageHandoff } from "@/components/StageHandoff";
import { ExternalLink } from "@/components/ExternalLink";
import { MadeWith } from "@/components/MadeWith";
import { darkroomHandoffHref } from "@/lib/darkroom/handoff";
import { PurgeRuns } from "@/components/proof/PurgeRuns";

function verdictDot(s: ReportSummary): string {
  if (s.passed) return "bg-accent-green";
  if (s.pending) return "bg-accent-amber";
  return "bg-accent-red";
}

export default function ProofPage() {
  // Resolved once per render: proofLive() reads the per-request runtime config, and
  // the fallback path when the injected global is missing rebuilds the whole
  // config on every call.
  const live = proofLive();
  // version: null = loading, "" = unreachable, "demo", or a real version string.
  const [version, setVersion] = useState<string | null>(live ? null : "demo");
  const [summaries, setSummaries] = useState<ReportSummary[]>(live ? [] : [DEMO_SUMMARY]);
  const [selected, setSelected] = useState<string | null>(live ? null : DEMO_REPORT.run_id);
  const [report, setReport] = useState<EvalReport | null>(live ? null : DEMO_REPORT);
  // The open report as last recomputed by an applied review. Kept apart from
  // `report`, which is ProofBoard's `initialReport`: feeding the recompute back
  // there would reset the board's review session.
  const [reviewed, setReviewed] = useState<EvalReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null until /health answers; drives the run affordance (#66). Deliberately
  // NOT proofLive(): that is the page's mode and says nothing about whether
  // argus-proof will accept a run. On the demo host the two disagree.
  const [health, setHealth] = useState<ProofHealth | null>(null);
  const unreachable = version === "";
  // Static demo: no real evaluation has been recorded yet, so the page leads
  // with an honest "coming soon" and only shows the bundled synthetic report
  // (clearly labelled) when the visitor asks to preview the review UI.
  const [previewSample, setPreviewSample] = useState(false);

  // Demo mode has no backend at all, so it is a settled `false` rather than an
  // unresolved `null` — the review still works, it just recomputes locally.
  const writable: Capability = live ? allowsEval(health) : false;

  const evalDeniedReason =
    "Live evaluation is disabled on this host — it generates images on a GPU. Browse the stored reports below; ratings are previewed locally but this host won't persist them.";

  // Live: reachability + the run list. Demo needs no backend.
  useEffect(() => {
    if (!live) return;
    const ctrl = new AbortController();
    (async () => {
      // allSettled, not all: a failing /reports must not discard a /health that
      // answered. Coupling them meant one broken endpoint hid the whole page
      // behind "server is not running" AND threw away the capability probe the
      // run/save gating depends on.
      const [h, list] = await Promise.allSettled([getProofHealth(ctrl.signal), listReports(ctrl.signal)]);
      if (ctrl.signal.aborted) return;
      if (h.status === "fulfilled") {
        setVersion(h.value.version);
        setHealth(h.value);
      }
      if (list.status === "fulfilled") {
        setSummaries(list.value);
        if (list.value.length > 0) setSelected(list.value[0].run_id);
      }
      // Only a failed /health means "not running" — that is the reachability
      // probe. A healthy server with a broken /reports still renders.
      if (h.status === "rejected") setVersion("");
    })();
    return () => ctrl.abort();
  }, [live]);

  // Load the selected run's report, aborting a slower in-flight fetch so a quick
  // run switch can't land an earlier response over the current selection.
  const loadReport = useCallback(async (runId: string, signal?: AbortSignal) => {
    if (!live) {
      setReport(DEMO_REPORT);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fresh = await getReport(runId, signal);
      setReport(fresh);
      // A reload is the server's latest word: an older applied review must not shadow it.
      setReviewed(null);
    } catch (err) {
      if (signal?.aborted) return; // superseded by a newer selection
      setError(err instanceof Error ? err.message : "Failed to load report");
      setReport(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [live]);

  // Bumped to load again without a selection change: re-clicking a run whose
  // load failed, or a finished run that is already the selected one.
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!selected) return;
    const ctrl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a fetch that follows the selection; only its spinner is set at once (demo mode adopts the bundled report).
    void loadReport(selected, ctrl.signal);
    return () => ctrl.abort();
  }, [selected, loadReport, reloadKey]);

  // An applied review recomputes the report's pass rate and HITL queue: bring
  // the run list's line for it in step, so the list and the board agree.
  const onReportChange = useCallback((updated: EvalReport) => {
    setReviewed(updated);
    setSummaries((cur) => withReportSummary(cur, updated));
  }, []);
  const current = report && reviewed?.run_id === report.run_id ? reviewed : report;

  // A passed report hands its checkpoint and LoRAs on to /darkroom (#199), from
  // the run manifest proof serves for it (argus-proof#57). Undefined while
  // unknown or not asked; null when the run directory is gone.
  const passedRun = live && current?.verdict.passed && servesReportManifest(health) ? current.run_id : null;
  const [manifest, setManifest] = useState<{ runId: string; value: ReportManifest | null } | null>(null);
  useEffect(() => {
    if (!passedRun) return;
    const ctrl = new AbortController();
    getReportManifest(passedRun, ctrl.signal)
      .then((value) => setManifest({ runId: passedRun, value }))
      .catch(() => {
        // Unreadable manifest: hand off without models rather than block the link.
        if (!ctrl.signal.aborted) setManifest({ runId: passedRun, value: null });
      });
    return () => ctrl.abort();
  }, [passedRun]);
  const shownManifest = manifest && manifest.runId === passedRun ? manifest : null;
  const darkroomHref = shownManifest?.value ? darkroomHandoffHref(shownManifest.value) : "/darkroom";

  // A finished evaluation run: refresh the run browser and land on the new
  // scored report for HITL review.
  // A devmode purge (#229): re-read the list, and leave a run that no longer exists.
  const onPurged = useCallback(
    async (removed: string | null) => {
      let next: ReportSummary[] = [];
      try {
        next = await listReports();
      } catch {
        // the list refresh is best-effort; the deleted run is dropped below regardless
        next = summaries.filter((s) => removed !== null && s.run_id !== removed);
      }
      setSummaries(next);
      if (removed === null || removed === selected) {
        setReport(null);
        const nextRun = next[0]?.run_id ?? null;
        // No run left: the aborted load leaves its spinner to a successor that
        // never starts (the selection effect returns early on null), so clear it here.
        if (nextRun === null) {
          setLoading(false);
          setError(null);
        }
        setSelected(nextRun);
      }
    },
    [summaries, selected],
  );

  const onRunComplete = useCallback(async (runId: string) => {
    try {
      setSummaries(await listReports());
    } catch {
      // the list refresh is best-effort; the report itself still loads below
    }
    setSelected(runId);
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        active="/proof"
        logo={{ letter: "P" }}
        title="Argus Proof"
        subtitle="Post-training LoRA evaluation & review"
        badge={
          STATIC_DEMO && !previewSample ? (
            <DemoBadge state="off" title="No recorded evaluation run yet; a real run needs argus-proof and a GPU. See the README." />
          ) : version === "demo" ? (
            <DemoBadge state="sample" title="No argus-proof answering: a bundled synthetic report, not real output." />
          ) : (
            <ApiVersionBadge label="argus-proof" version={version} prefix="v" />
          )
        }
      />

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <MadeWith pkg="proof" verb="Report from" version={version} command="argus-proof run → score → gate" className="mb-4" />
        {STATIC_DEMO && !previewSample ? (
          <ProofComingSoon onPreview={() => setPreviewSample(true)} />
        ) : unreachable ? (
          <div className="mx-auto max-w-xl space-y-4 py-24 text-center">
            <h2 className="text-lg font-medium text-foreground/70">The argus-proof server is not running.</h2>
            <p className="text-sm text-muted">
              Start it with <code className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-xs">argus-proof serve --cors</code>{" "}
              on <span className="font-mono">:8104</span>, or browse the bundled sample in demo mode.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {STATIC_DEMO && (
              <p role="note" className="text-xs leading-relaxed text-muted">
                <span className="font-medium text-foreground/80">Synthetic sample</span> — hand-made scores to show the
                review UI, not a real evaluation. Ratings stay in your browser.{" "}
                <button
                  type="button"
                  onClick={() => setPreviewSample(false)}
                  className="cursor-pointer underline underline-offset-2 hover:text-foreground"
                >
                  Back
                </button>
              </p>
            )}
            {live && (
              <NewEvaluation onComplete={onRunComplete} canRun={writable} deniedReason={evalDeniedReason} />
            )}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            {/* Run browser */}
            <aside className="space-y-1">
              <div className="mb-2 text-[10px] uppercase tracking-wide text-muted">Runs</div>
              {summaries.length === 0 && <p className="text-sm text-muted">No scored runs yet.</p>}
              {summaries.map((s) => (
                <button
                  key={s.run_id}
                  type="button"
                  onClick={() => {
                    setSelected(s.run_id);
                    setReloadKey((k) => k + 1);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                    selected === s.run_id ? "border-accent-purple/60 bg-surface" : "border-border bg-surface/40 hover:bg-surface-hover"
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${verdictDot(s)}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs text-foreground">{s.run_id}</span>
                    <span className="block text-[10px] text-muted">
                      {(s.pass_rate * 100).toFixed(0)}% · {s.n_needs_hitl} {s.n_needs_hitl === 1 ? "group" : "groups"} to review
                      {s.n_refined ? ` · ${s.n_refined} refined` : ""}
                    </span>
                  </span>
                </button>
              ))}
              {live && permits(allowsPurge(health)) && <PurgeRuns selected={selected} onPurged={(r) => void onPurged(r)} />}
            </aside>

            {/* Selected report */}
            <div>
              {loading && <p className="py-12 text-center text-sm text-muted">Loading report…</p>}
              {error && <p className="py-12 text-center text-sm text-accent-red-ink">{error}</p>}
              {!loading && !error && report && (
                <>
                  <ProofBoard
                    key={report.run_id}
                    initialReport={report}
                    live={live}
                    canWrite={writable}
                    onReportChange={onReportChange}
                  />
                  {/* A LoRA that passed is ready for the next stage: bake a georeferenced map with it. */}
                  {current?.verdict.passed && (
                    <div className="mt-6 flex justify-end gap-2">
                      <StageHandoff href={darkroomHref} />
                      <StageHandoff href="/atlas" />
                    </div>
                  )}
                  {current?.verdict.passed && shownManifest && shownManifest.value === null && (
                    <p className="mt-2 text-right text-xs text-muted">
                      This run&apos;s directory is gone, so Darkroom opens without its checkpoint and LoRA.
                    </p>
                  )}
                </>
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

/** The static demo's /proof: what the stage does, and that no recorded run exists yet. */
function ProofComingSoon({ onPreview }: { onPreview: () => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-5 py-16 text-center">
      <h2 className="text-lg font-medium text-foreground/80">No recorded evaluation run yet.</h2>
      <p className="text-sm leading-relaxed text-muted">
        Proof is the post-training stage: it renders a seed/weight grid from a trained LoRA, scores every image
        (identity, CLIP alignment, aesthetics, preference, near-duplicates), gates the run on pass rate and
        diversity, and hands the borderline images to a keyboard-first human review. A real run will be recorded
        here once one has been made — this demo will not show invented results as if they were.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <button
          type="button"
          onClick={onPreview}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-foreground/80 transition-colors hover:bg-surface-hover"
        >
          Preview the review UI with synthetic data
        </button>
        <ExternalLink href={REPO_URL} className="rounded-lg px-4 py-2 text-accent-teal-ink hover:underline">
          Run it yourself
        </ExternalLink>
      </div>
    </div>
  );
}
