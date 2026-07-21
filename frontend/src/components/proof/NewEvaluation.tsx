"use client";

import { useEffect, useState } from "react";
import { CapabilityNotice } from "@/components/CapabilityNotice";
import {
  listExports,
  listProofModels,
  listScorers,
  runEvalStream,
  type ProofExport,
  type ProofModels,
  type RunEvalProgress,
} from "@/lib/proofApi";

/** Generation + scoring phases surfaced while a run streams. */
type Phase = "generating" | "scoring";

interface NewEvaluationProps {
  /** Called with the stored report's run_id once generation + scoring finish. */
  onComplete: (runId: string) => void;
  /**
   * Why this server won't run an evaluation, or `null` when it will. Non-null
   * keeps the panel visible but sealed — see {@link CapabilityNotice}. Covers
   * both "refused" (replay mode) and "not yet known" (`/health` still in
   * flight), which is why it arrives as a reason string rather than a boolean.
   */
  disabledReason?: string | null;
}

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted/60 focus:border-accent-purple focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Picker that degrades to free text when the server has nothing to list
 * (e.g. no models dir configured) — the run can still name models directly. */
function NameSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  if (options.length === 0) {
    return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />;
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/**
 * Trigger panel for a new evaluation run: pick a curator export + models, tune
 * seeds/steps, and stream generation + scoring progress (POST /run/stream).
 * On completion the parent lands on the scored report for HITL review.
 */
export function NewEvaluation({ onComplete, disabledReason = null }: NewEvaluationProps) {
  const [open, setOpen] = useState(false);
  const [exports, setExports] = useState<ProofExport[]>([]);
  const [models, setModels] = useState<ProofModels>({ checkpoints: [], loras: [] });

  const [exportName, setExportName] = useState("");
  const [checkpoint, setCheckpoint] = useState("");
  const [lora, setLora] = useState("");
  const [weight, setWeight] = useState("1.0");
  const [seeds, setSeeds] = useState("1, 2, 3");
  const [steps, setSteps] = useState("25");
  const [prompt, setPrompt] = useState("");

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("generating");
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  // True when the server has no learned scorers installed — a run then scores
  // nothing and routes every image to manual review (light `server,cli` image).
  const [scoringUnavailable, setScoringUnavailable] = useState(false);

  // Load the pickers when the panel opens; free-text fallbacks cover failures.
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    (async () => {
      // allSettled: one failing endpoint mustn't discard the others.
      const [ex, mo, sc] = await Promise.allSettled([
        listExports(ctrl.signal),
        listProofModels(ctrl.signal),
        listScorers(ctrl.signal),
      ]);
      if (ex.status === "fulfilled") {
        setExports(ex.value);
        setExportName((cur) => cur || (ex.value[0]?.name ?? ""));
      }
      if (mo.status === "fulfilled") {
        setModels(mo.value);
        setCheckpoint((cur) => cur || (mo.value.checkpoints[0] ?? ""));
        setLora((cur) => cur || (mo.value.loras[0] ?? ""));
      }
      if (sc.status === "fulfilled") {
        // Warn only when NO learned (metric-bearing) scorer is available.
        const learned = sc.value.filter((s) => s.metric != null);
        setScoringUnavailable(learned.length > 0 && learned.every((s) => !s.available));
      }
    })();
    return () => ctrl.abort();
  }, [open]);

  // De-duplicate: the backend keys each generated image by `<run_id>-<seed>`,
  // so a repeated seed collides (same image_id → duplicate React keys and
  // shared HITL edits in the board).
  const seedList = [
    ...new Set(
      seeds
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0),
    ),
  ];
  // Preserve a valid weight of 0 (baseline/ablation); only empty or non-numeric
  // falls back to 1.0.
  const loraWeight = weight.trim() !== "" && Number.isFinite(Number(weight)) ? Number(weight) : 1.0;
  // Floor to a positive integer — the server rejects non-ints and <= 0.
  const stepsFloor = Math.floor(Number(steps));
  const stepsVal = Number.isFinite(stepsFloor) && stepsFloor > 0 ? stepsFloor : 25;
  const ready = checkpoint.trim() && lora.trim() && seedList.length > 0 && (exportName || prompt.trim());

  const start = async () => {
    setRunning(true);
    setError(null);
    setPhase("generating");
    setProgress({ done: 0, total: seedList.length });
    try {
      const summary = await runEvalStream(
        {
          lora: lora.trim(),
          base_checkpoint: checkpoint.trim(),
          lora_weight: loraWeight,
          export: exportName || undefined,
          prompt: prompt.trim() || undefined,
          seeds: seedList,
          steps: stepsVal,
        },
        (p: RunEvalProgress) => {
          if (p.type === "start") setProgress({ done: 0, total: p.total ?? seedList.length });
          else if (p.type === "progress") setProgress({ done: p.completed ?? 0, total: p.total ?? seedList.length });
          else if (p.type === "scoring") setPhase("scoring");
        },
      );
      onComplete(summary.run_id);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation run failed");
    } finally {
      setRunning(false);
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const selectedExport = exports.find((e) => e.name === exportName);

  const sealed = disabledReason !== null;

  return (
    <section className="rounded-xl border border-border bg-surface/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={sealed}
        aria-expanded={open}
        title={disabledReason ?? undefined}
        className="flex w-full cursor-pointer items-center justify-between px-5 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-sm font-medium text-foreground">New evaluation</span>
        <span className="text-xs text-muted">
          {sealed ? "Unavailable" : open ? "Hide" : "Generate + score a LoRA sample grid"}
        </span>
      </button>

      {/* Sealed: say why in place of the form, so the capability is legible
          rather than the panel just being unresponsive to a click. */}
      {sealed && (
        <div className="border-t border-border px-5 py-4">
          <CapabilityNotice reason={disabledReason} />
        </div>
      )}

      {open && !sealed && (
        <div className="space-y-4 border-t border-border px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Export (prompt source)">
              <NameSelect value={exportName} onChange={setExportName} options={exports.map((e) => e.name)} placeholder="export dir name" />
            </Field>
            <Field label="Base checkpoint">
              <NameSelect value={checkpoint} onChange={setCheckpoint} options={models.checkpoints} placeholder="sdxl_base.safetensors" />
            </Field>
            <Field label="LoRA">
              <NameSelect value={lora} onChange={setLora} options={models.loras} placeholder="subject.safetensors" />
            </Field>
            <Field label="LoRA weight">
              <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" className={inputClass} />
            </Field>
            <Field label="Seeds (one image each)">
              <input value={seeds} onChange={(e) => setSeeds(e.target.value)} placeholder="1, 2, 3" className={inputClass} />
            </Field>
            <Field label="Steps">
              <input value={steps} onChange={(e) => setSteps(e.target.value)} inputMode="numeric" className={inputClass} />
            </Field>
          </div>
          <Field label="Prompt override (optional — otherwise the export's caption is used)">
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="a photo of sks person…" className={inputClass} />
          </Field>

          {scoringUnavailable && (
            <p className="rounded-lg border border-accent-orange/30 bg-accent-orange/5 px-3 py-2 text-[11px] leading-relaxed text-accent-orange">
              No learned scorers are installed on this proof server, so a run will generate images but
              score nothing — every sample lands in manual review. Rebuild the proof image with{" "}
              <span className="font-mono">PROOF_EXTRAS=server,cli,score</span> to enable identity / quality / safety scoring.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={start}
              disabled={!ready || running}
              className="rounded-lg bg-accent-purple px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {running ? (phase === "scoring" ? "Scoring…" : "Generating…") : "Run evaluation"}
            </button>
            {running && (
              <div className="flex min-w-48 flex-1 items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                      phase === "scoring" ? "animate-pulse bg-accent-green" : "bg-accent-purple"
                    }`}
                    style={{ width: phase === "scoring" ? "100%" : `${pct}%` }}
                  />
                </div>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                  {phase === "scoring" ? "scoring" : `${progress.done} / ${progress.total}`}
                </span>
              </div>
            )}
            {error && <span className="text-xs text-accent-red">{error}</span>}
            {!running && selectedExport && (
              <span className="text-[11px] text-muted/70">
                {selectedExport.n_rows} dataset rows
                {selectedExport.has_references ? " · has identity references" : " · no references/ dir (identity scoring skipped)"}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
