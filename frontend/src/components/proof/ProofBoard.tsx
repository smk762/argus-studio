"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyEdits,
  compositeScore,
  editsToUpdates,
  imageState,
  METRIC_LABELS,
  presentMetrics,
  proofImageUrl,
  rejectLabel,
  submitHitl,
  type EvalReport,
  type HitlEdit,
  type ImageScores,
  type MetricScores,
  type RejectReasonCode,
} from "@/lib/proofApi";
import { StarRating } from "@/components/proof/StarRating";
import { RejectReasonPicker } from "@/components/proof/RejectReasonPicker";

/** Deterministic shuffle keyed by the run id, so blind-mode order is randomised
 * once per run rather than re-shuffling on every keystroke. */
function shuffledIndices(n: number, seedStr: string): number[] {
  let seed = 0;
  for (const ch of seedStr) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000; // 2^32 keeps the result in [0, 1); /0xffffffff could hit 1.0
  };
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

function barColor(v: number): string {
  if (v >= 0.7) return "bg-accent-green";
  if (v >= 0.4) return "bg-accent-amber";
  return "bg-accent-red";
}

function MetricBar({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  return (
    <div className="flex items-center gap-2" title={hint}>
      <span className="w-16 shrink-0 text-[11px] text-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded bg-surface-hover">
        {value != null && <div className={`h-full ${barColor(value)}`} style={{ width: `${value * 100}%` }} />}
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-[11px] text-foreground/80">
        {value != null ? value.toFixed(2) : "—"}
      </span>
    </div>
  );
}

const STATE_STYLES = {
  pass: "border-accent-green/50 bg-accent-green/15 text-accent-green",
  fail: "border-accent-red/50 bg-accent-red/15 text-accent-red",
  needs_hitl: "border-accent-amber/50 bg-accent-amber/15 text-accent-amber",
} as const;

const STATE_LABEL = { pass: "Pass", fail: "Fail", needs_hitl: "Needs review" } as const;

function StateBadge({ img }: { img: ImageScores }) {
  const s = imageState(img);
  return <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${STATE_STYLES[s]}`}>{STATE_LABEL[s]}</span>;
}

function meanCount(means: MetricScores): number {
  return presentMetrics(means).length;
}

/** The generated sample: the real image (served by id from the proof server)
 * when live, a placeholder in demo mode or when the file isn't servable. The
 * image itself stays visible in blind mode — only identifying metadata and
 * scores are hidden, since a reviewer has to see the sample to rate it. */
function SampleImage({ runId, img, hidden, live }: { runId: string; img: ImageScores; hidden: boolean; live: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!live || failed) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border bg-surface-hover/40 text-center text-[11px] text-muted/60">
        {hidden ? "blind sample" : `seed ${img.seed}`}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- served by the proof API, not a Next asset
    <img
      src={proofImageUrl(runId, img.image_id)}
      alt={hidden ? "blind sample" : `${img.image_id} (seed ${img.seed})`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-square w-full rounded-lg border border-border bg-surface-hover/40 object-cover"
    />
  );
}

interface ProofBoardProps {
  initialReport: EvalReport;
  live: boolean;
}

export function ProofBoard({ initialReport, live }: ProofBoardProps) {
  const [report, setReport] = useState<EvalReport>(initialReport);
  const [edits, setEdits] = useState<Map<string, HitlEdit>>(new Map());
  const [rater, setRater] = useState("");
  const [blind, setBlind] = useState(false);
  const [needsOnly, setNeedsOnly] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // A new run resets the review session.
  useEffect(() => {
    setReport(initialReport);
    setEdits(new Map());
    setRevealed(new Set());
    setFocus(0);
  }, [initialReport]);

  // The report as the reviewer's unsaved edits make it look right now. With no
  // edits it IS the report, so the header shows the server's authoritative
  // verdict/aggregate rather than a client recompute at the default threshold.
  const view = useMemo(
    () => (edits.size > 0 ? applyEdits(report, edits, rater || null) : report),
    [report, edits, rater],
  );

  // Display order is computed from the ORIGINAL report states (not the edited
  // view) and only recomputed on run/filter change, so a card doesn't jump as
  // it's rated — keyboard focus stays on the sample under the cursor. Blind →
  // randomised (remove position bias); otherwise the borderline band first
  // (auto pre-pass: needs-review, then lowest composite).
  const order = useMemo(() => {
    const imgs = report.images;
    let idx = imgs.map((_, i) => i);
    if (blind) {
      idx = shuffledIndices(imgs.length, report.run_id);
    } else {
      const rank = (img: ImageScores) => (imageState(img) === "needs_hitl" ? 0 : 1);
      idx.sort((a, b) => {
        const dr = rank(imgs[a]) - rank(imgs[b]);
        if (dr !== 0) return dr;
        return (compositeScore(imgs[a].metrics) ?? 1) - (compositeScore(imgs[b].metrics) ?? 1);
      });
    }
    if (needsOnly) idx = idx.filter((i) => imageState(imgs[i]) === "needs_hitl");
    return idx;
  }, [report, blind, needsOnly]);

  const editFor = useCallback(
    (img: ImageScores): HitlEdit => edits.get(img.image_id) ?? { hitl_rating: img.hitl_rating, reject_reasons: img.reject_reasons },
    [edits],
  );

  const setEdit = useCallback((imageId: string, patch: Partial<HitlEdit>, base: HitlEdit) => {
    setEdits((cur) => {
      const next = new Map(cur);
      const existing = next.get(imageId) ?? base;
      next.set(imageId, { ...existing, ...patch });
      return next;
    });
  }, []);

  const rate = useCallback(
    (img: ImageScores, value: number | null) => {
      const base = editFor(img);
      setEdit(img.image_id, { hitl_rating: value }, base);
      if (blind) setRevealed((r) => new Set(r).add(img.image_id));
    },
    [blind, editFor, setEdit],
  );

  const toggleReason = useCallback(
    (img: ImageScores, code: RejectReasonCode) => {
      const base = editFor(img);
      const has = base.reject_reasons.some((r) => r.code === code);
      const reject_reasons = has
        ? base.reject_reasons.filter((r) => r.code !== code)
        : [...base.reject_reasons, { code }];
      setEdit(img.image_id, { reject_reasons }, base);
      if (blind) setRevealed((r) => new Set(r).add(img.image_id));
    },
    [blind, editFor, setEdit],
  );

  // Keyboard-first throughput: 1–5 rate the focused sample, 0/Backspace clears,
  // arrows move focus. Ignore while typing in the rater field.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if (order.length === 0) return;
    const img = view.images[order[Math.min(focus, order.length - 1)]];
    if (e.key >= "1" && e.key <= "5") {
      rate(img, Number(e.key));
      e.preventDefault();
    } else if (e.key === "0" || e.key === "Backspace") {
      rate(img, null);
      e.preventDefault();
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      setFocus((f) => Math.min(f + 1, order.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      setFocus((f) => Math.max(f - 1, 0));
      e.preventDefault();
    }
  };

  const dirty = edits.size > 0;

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Demo persists exactly the preview the reviewer is looking at (`view`);
      // live sends the edits and adopts the server's authoritative recompute.
      const updated = live
        ? await submitHitl(report.run_id, { rater: rater || null, updates: editsToUpdates(edits) })
        : view;
      setReport(updated);
      setEdits(new Map());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save review");
    } finally {
      setSaving(false);
    }
  };

  const agg = view.aggregate;

  return (
    <div ref={boardRef} tabIndex={0} onKeyDown={onKeyDown} className="space-y-6 outline-none">
      {/* Summary header */}
      <section className="rounded-xl border border-border bg-surface/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-mono text-sm text-foreground">{report.run_id}</h2>
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                  view.verdict.passed
                    ? STATE_STYLES.pass
                    : view.verdict.pending
                      ? STATE_STYLES.needs_hitl
                      : STATE_STYLES.fail
                }`}
              >
                {view.verdict.passed ? "Passed" : view.verdict.pending ? "Pending review" : "Failed"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">{view.verdict.reasons[0]}</p>
          </div>
          <div className="flex items-center gap-5 text-center">
            <div>
              <div className="text-2xl font-semibold text-foreground">{(agg.pass_rate * 100).toFixed(0)}%</div>
              <div className="text-[10px] uppercase tracking-wide text-muted">pass rate</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-foreground">{agg.n_needs_hitl}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted">need review</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-foreground">
                {agg.n_passed}/{agg.n_groups ?? agg.n_images}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted">groups passed</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            {METRIC_LABELS.map((m) => (
              <MetricBar key={m.key} label={m.label} value={agg.means[m.key]} hint={`Mean ${m.label} — ${m.hint}`} />
            ))}
            <MetricBar label="Diversity" value={agg.diversity} hint="Output variety (higher = more varied)" />
          </div>
          <div className="text-[11px] text-muted">
            <div className="mb-1 font-medium text-foreground/70">Scorers</div>
            {report.scorers.length === 0 ? (
              <p>No automated scorers ran — every sample is awaiting human review.</p>
            ) : (
              <ul className="space-y-0.5">
                {report.scorers.map((s) => (
                  <li key={`${s.name}-${s.metric}`} className="font-mono">
                    {s.name} <span className="text-muted/60">({s.metric})</span>
                    {s.model ? ` · ${s.model}` : ""}
                    {s.version ? ` v${s.version}` : ""}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2">{meanCount(agg.means)} of {METRIC_LABELS.length} metric axes scored.</p>
          </div>
        </div>
      </section>

      {/* Review controls */}
      <section className="flex flex-wrap items-center gap-3">
        <input
          value={rater}
          onChange={(e) => setRater(e.target.value)}
          placeholder="Rater id (e.g. your initials)"
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted/60 focus:border-accent-purple focus:outline-none"
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} className="accent-accent-purple" />
          Blind mode
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={needsOnly} onChange={(e) => setNeedsOnly(e.target.checked)} className="accent-accent-purple" />
          Needs-review only
        </label>
        {blind && (
          <button
            type="button"
            onClick={() => setRevealed(new Set(view.images.map((i) => i.image_id)))}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
          >
            Reveal all
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          {saveError && <span className="text-xs text-accent-red">{saveError}</span>}
          {dirty && <span className="text-xs text-muted">{edits.size} unsaved</span>}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-lg bg-accent-purple px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Saving…" : live ? "Save review" : "Apply review"}
          </button>
        </div>
      </section>
      <p className="-mt-3 text-[11px] text-muted/70">
        Keyboard: <kbd className="rounded bg-surface-hover px-1">1</kbd>–<kbd className="rounded bg-surface-hover px-1">5</kbd> rate ·{" "}
        <kbd className="rounded bg-surface-hover px-1">0</kbd> clear · <kbd className="rounded bg-surface-hover px-1">←</kbd>
        <kbd className="rounded bg-surface-hover px-1">→</kbd> move focus
      </p>

      {/* Review grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {order.map((imgIndex, pos) => {
          const img = view.images[imgIndex];
          const edit = editFor(img);
          const hidden = blind && !revealed.has(img.image_id);
          const focused = pos === Math.min(focus, order.length - 1);
          const comp = compositeScore(img.metrics);
          return (
            <div
              key={img.image_id}
              onClick={() => setFocus(pos)}
              className={`space-y-3 rounded-xl border p-3 transition-colors ${
                focused ? "border-accent-purple/70 bg-surface" : "border-border bg-surface/40"
              }`}
            >
              <SampleImage runId={report.run_id} img={img} hidden={hidden} live={live} />

              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-[11px] text-foreground/80">
                  {hidden ? `Sample ${pos + 1}` : img.image_id}
                </span>
                {!hidden && <StateBadge img={img} />}
              </div>

              {!hidden && (
                <div className="space-y-1">
                  {presentMetrics(img.metrics).map((m) => (
                    <MetricBar key={m.key} label={m.label} value={img.metrics[m.key]} hint={m.hint} />
                  ))}
                  {comp != null && (
                    <div className="pt-0.5 text-right text-[10px] text-muted">composite {comp.toFixed(2)}</div>
                  )}
                </div>
              )}

              <div className="space-y-2 border-t border-border pt-2">
                <StarRating value={edit.hitl_rating} onChange={(v) => rate(img, v)} size="sm" />
                <RejectReasonPicker
                  selected={edit.reject_reasons.map((r) => r.code)}
                  onToggle={(code) => toggleReason(img, code)}
                />
                {edit.reject_reasons.length > 0 && (
                  <p className="text-[10px] text-accent-red/80">
                    {edit.reject_reasons.map((r) => rejectLabel(r.code)).join(", ")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </section>
      {order.length === 0 && <p className="py-12 text-center text-sm text-muted">No samples match the current filter.</p>}
    </div>
  );
}
