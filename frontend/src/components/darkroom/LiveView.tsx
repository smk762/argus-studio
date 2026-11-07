"use client";

import { PHASE_LABEL, isRunning, scannedCount, type LiveState } from "@/lib/darkroom/live";
import type { PolicyRow } from "@/lib/darkroom/shields";

import { PreflightPanel } from "./PreflightPanel";
import { ShieldGrid } from "./ShieldGrid";
import { Button, Card, Notice, SectionTitle, Spinner } from "./ui";

const STAGES = ["preflight", "queued", "rendering", "scanning", "complete"] as const;

/** Progress from the SSE stream: pre-flight, queued, the ComfyUI step bar, then one event per finished scan cell. */
export function LiveView({ live, onStop, onClear }: { live: LiveState; onStop: () => void; onClear: () => void }) {
  const running = isRunning(live);
  const scanned = scannedCount(live);
  const refused = live.preflight?.outcome === "refused";
  const stageIndex = refused ? 0 : STAGES.indexOf(live.phase as (typeof STAGES)[number]);
  // A refusal completes too, but nothing past pre-flight ran.
  const finished = live.phase === "complete" && !refused;
  const rows: PolicyRow[] = live.policies.map((policy) => ({ policy, enforcing: policy === live.enforcing, pair: live.cells[policy] ?? null }));
  const steps = live.progress;
  const renderPct = steps ? Math.round((steps.step / Math.max(1, steps.total)) * 100) : 0;
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <SectionTitle>Generation</SectionTitle>
          {running ? <Spinner /> : null}
          <span className="text-sm text-foreground">{live.phase === "error" ? "Stopped" : PHASE_LABEL[live.phase]}</span>
          <div className="ml-auto flex gap-2">
            {running ? (
              <Button small onClick={onStop} title="Close the stream. Darkroom finishes on its own and keeps the record.">
                Stop
              </Button>
            ) : (
              <Button small onClick={onClear}>
                Clear
              </Button>
            )}
          </div>
        </div>
        <ol className="mt-3 grid grid-cols-5 gap-1 text-xs" aria-label="Stages">
          {STAGES.map((stage, index) => {
            const done = index < stageIndex || finished;
            const current = index === stageIndex && !finished;
            return (
              <li key={stage} className="space-y-1">
                <div className={`h-1.5 rounded-full ${done ? "bg-accent-green" : current ? "bg-accent-purple" : "bg-border"}`} aria-hidden="true" />
                <span className={current ? "text-foreground" : "text-muted"}>{PHASE_LABEL[stage]}</span>
              </li>
            );
          })}
        </ol>
        {steps ? (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted">
              <span>ComfyUI steps</span>
              <span>
                {steps.step} / {steps.total}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={steps.total} aria-valuenow={steps.step} aria-label="ComfyUI steps">
              <div className="h-full bg-accent-purple transition-[width]" style={{ width: `${renderPct}%` }} />
            </div>
          </div>
        ) : null}
        {live.phase === "scanning" || scanned.done > 0 ? (
          <p className="mt-2 text-xs text-muted">
            Scans: {scanned.done} / {scanned.total} cells
          </p>
        ) : null}
        {live.phase === "error" ? <Notice tone="error" className="mt-3">{live.error}</Notice> : null}
      </Card>

      {live.preflight ? <PreflightPanel preflight={live.preflight} /> : null}

      {!refused && live.policies.length > 0 ? (
        <Card>
          <SectionTitle>Output scans</SectionTitle>
          <p className="mt-1 text-xs text-muted">Each cell fills in as its scan finishes. Grey dashes are still pending.</p>
          <div className="mt-3">
            <ShieldGrid guard={{ enforcing_policy: live.enforcing, advisory_policies: live.policies.filter((name) => name !== live.enforcing), scans: {} }} rows={rows} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
