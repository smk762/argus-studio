"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearSentEdits,
  proofImageUrl,
  submitRefinement,
  type EvalReport,
  type ImageScores,
} from "@/lib/proofApi";
import {
  applyRefinement,
  refinedRanking,
  refinementSaveVia,
  refinementUpdates,
  storedRefinement,
  withRefinementEdit,
  type RefinementEdit,
} from "@/lib/proofRefinement";
import type { Capability } from "@/lib/capabilities";
import { StarRating } from "@/components/proof/StarRating";

function Thumb({ runId, img, live }: { runId: string; img: ImageScores; live: boolean }) {
  const src = proofImageUrl(runId, img.image_id);
  // The URL that failed, not a flag: rows reset in place on a run change, and image ids can repeat across runs.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!live || failedSrc === src) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-surface-hover/40 text-[9px] text-muted">
        seed {img.seed}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- served by the proof API, not a Next asset
    <img
      src={src}
      alt={`${img.image_id} (seed ${img.seed})`}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className="h-14 w-14 shrink-0 rounded-md border border-border bg-surface-hover/40 object-cover"
    />
  );
}

interface RefinementPanelProps {
  /** The board's report as last saved: the passing set is the server's, not the unsaved preview. */
  report: EvalReport;
  live: boolean;
  /** Same capability as the HITL save: a read-only proof host refuses `/refine` too. */
  canWrite: Capability;
  rater: string | null;
  /** The board has unsaved review edits, which may change the passing set once saved. */
  reviewDirty: boolean;
  /** Blind review is on: the panel names images, so it stays closed. */
  blind: boolean;
  onRefined: (report: EvalReport) => void;
}

/**
 * The optional refinement stage (#68): rank the passing images 1–5 with notes,
 * best-first, without touching the verdict. Retract clears an image's layer.
 */
export function RefinementPanel({ report, live, canWrite, rater, reviewDirty, blind, onRefined }: RefinementPanelProps) {
  const [edits, setEdits] = useState<Map<string, RefinementEdit>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A new run starts a new refinement session (same render-time reset as the board).
  const [runId, setRunId] = useState(report.run_id);
  if (runId !== report.run_id) {
    setRunId(report.run_id);
    setEdits(new Map());
    setError(null);
    setSaving(false);
  }
  // The run on screen, for a save that outlasts it: that reset happens in place, not by a remount.
  const currentRun = useRef(report.run_id);
  useEffect(() => {
    currentRun.current = report.run_id;
  }, [report.run_id]);

  // Ordered from the saved report only, so a row doesn't jump while it's ranked.
  const ranked = useMemo(() => refinedRanking(report.images), [report.images]);
  const nRefined = ranked.filter((img) => img.refinement != null).length;

  // One answer for the button and the save: a panel that isn't live applies locally even if a capability
  // resolved earlier still permits a write.
  const via = refinementSaveVia(live, canWrite);
  const localApply = via === "local";
  const writeRefused = live && canWrite === false;
  const canSave = via !== null;
  const dirty = edits.size > 0;

  const edit = (img: ImageScores, patch: Partial<RefinementEdit>) =>
    setEdits((cur) => withRefinementEdit(cur, img, patch));

  const save = async () => {
    setSaving(true);
    setError(null);
    // Snapshot what this click commits: an edit made while the POST is in flight
    // stays unsaved. A reply for a run no longer on screen is dropped: the new
    // run's report, edits and saving state are not this save's to touch.
    const sent = edits;
    const startedFor = report.run_id;
    const stillCurrent = () => currentRun.current === startedFor;
    try {
      const updated = via === "server"
        ? await submitRefinement(startedFor, { rater, updates: refinementUpdates(sent) })
        : applyRefinement(report, sent, rater);
      if (!stillCurrent()) return;
      onRefined(updated);
      setEdits((cur) => clearSentEdits(cur, sent));
    } catch (err) {
      if (stillCurrent()) setError(err instanceof Error ? err.message : "Failed to save refinement");
    } finally {
      if (stillCurrent()) setSaving(false);
    }
  };

  return (
    <details className="group rounded-xl border border-border bg-surface/50 p-5">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-medium text-foreground">
          <span className="mr-1.5 inline-block text-muted transition-transform group-open:rotate-90" aria-hidden>
            ›
          </span>
          Refinement
        </h3>
        <span className="text-xs text-muted">
          Re-rank the passing images to find the best of the good. {nRefined} of {ranked.length} refined. The verdict
          doesn&apos;t change.
        </span>
      </summary>

      <div className="mt-4 space-y-3">
        {blind ? (
          <p className="text-xs text-muted">Turn off blind mode to refine: this list names each image.</p>
        ) : ranked.length === 0 ? (
          <p className="text-xs text-muted">No image has passed yet. Refinement only covers the passing set.</p>
        ) : (
          <>
            {reviewDirty && (
              <p className="text-xs text-warn-ink">
                This list is the saved passing set. Save your review first if it changes which images pass.
              </p>
            )}
            {writeRefused && (
              <p className="text-xs text-muted">This argus-proof host is read-only, so refinements can&apos;t be saved.</p>
            )}
            <ol className="space-y-2">
              {ranked.map((img, i) => {
                const stored = storedRefinement(img);
                const current = edits.get(img.image_id) ?? stored;
                return (
                  <li key={img.image_id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface/40 p-2">
                    <span className="w-5 text-right font-mono text-[11px] text-muted">{i + 1}</span>
                    <Thumb runId={report.run_id} img={img} live={live} />
                    <div className="min-w-0 flex-1 basis-40">
                      <div className="truncate font-mono text-[11px] text-foreground/80">{img.image_id}</div>
                      <div className="text-[10px] text-muted">
                        first pass {img.hitl_rating != null ? `${img.hitl_rating}★` : "auto"}
                        {img.refinement?.rater ? ` · refined by ${img.refinement.rater}` : ""}
                      </div>
                    </div>
                    <StarRating
                      value={current.rank}
                      onChange={(rank) => edit(img, { rank })}
                      size="sm"
                      disabled={saving}
                    />
                    <input
                      value={current.notes ?? ""}
                      onChange={(e) => edit(img, { notes: e.target.value })}
                      disabled={saving || current.rank === null}
                      placeholder={current.rank === null ? "Rank it to add a note" : "Notes"}
                      aria-label={`Refinement notes for ${img.image_id}`}
                      className="min-w-0 flex-1 basis-40 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground placeholder:text-muted/60 focus:border-accent-purple focus:outline-none disabled:opacity-50"
                    />
                    {stored.rank !== null && (
                      <button
                        type="button"
                        onClick={() => edit(img, { rank: null })}
                        disabled={saving || current.rank === null}
                        className="rounded-md border border-border px-2 py-1 text-[11px] text-muted hover:text-foreground disabled:opacity-40"
                      >
                        Retract
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="flex items-center justify-end gap-3">
              {error && <span className="text-xs text-accent-red-ink">{error}</span>}
              {dirty && (
                <span className="text-xs text-muted">
                  {edits.size} {writeRefused ? "not saved" : "unsaved"}
                </span>
              )}
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving || !canSave}
                className="rounded-lg bg-accent-purple px-4 py-1.5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {saving ? "Saving…" : localApply ? "Apply refinement" : canWrite === null ? "Checking…" : "Save refinement"}
              </button>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
