"use client";

import { useState } from "react";
import { purgeAllRuns, purgeRun } from "@/lib/proofApi";

type Pending = { kind: "one"; runId: string } | { kind: "all" } | null;

const DANGER =
  "cursor-pointer rounded-md border border-accent-red/40 px-2.5 py-1 text-xs text-accent-red-ink transition-colors hover:bg-accent-red/10 disabled:cursor-not-allowed disabled:opacity-40";
const PLAIN =
  "cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-40";

/**
 * Devmode deletes on /proof (#229, argus-proof#59): one run, or all of them.
 * Rendered only when the server lists `purge` in its capabilities; the client
 * gates the request too (#75). Each asks first, in the page: a report takes
 * its HITL review and refinement with it, and nothing brings a run back.
 */
export function PurgeRuns({ selected, onPurged }: { selected: string | null; onPurged: (removed: string | null) => void }) {
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === "one") await purgeRun(pending.runId);
      else await purgeAllRuns();
      onPurged(pending.kind === "one" ? pending.runId : null);
      setPending(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <div className="text-[10px] uppercase tracking-wide text-muted">Dev mode</div>
      {pending ? (
        <div role="group" aria-label="Confirm deleting runs" className="space-y-2 text-xs text-foreground/80">
          <p>
            {pending.kind === "one" ? (
              <>
                Delete <span className="font-mono">{pending.runId}</span>: its report, with the review and refinement in it,
                and its images?
              </>
            ) : (
              <>Delete every run: all reports, with their reviews and refinements, and all their images?</>
            )}{" "}
            This cannot be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void confirm()} disabled={busy} className={DANGER}>
              {busy ? "Deleting…" : pending.kind === "one" ? "Delete run for good" : "Delete all for good"}
            </button>
            {/* The safe choice is the one focus lands on. */}
            <button type="button" onClick={() => setPending(null)} disabled={busy} className={PLAIN} autoFocus>
              Keep
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => selected && setPending({ kind: "one", runId: selected })} disabled={!selected} className={DANGER}>
            Delete this run
          </button>
          <button type="button" onClick={() => setPending({ kind: "all" })} className={DANGER}>
            Delete all runs
          </button>
        </div>
      )}
      {error ? <p className="text-xs text-accent-red-ink">{error}</p> : null}
    </div>
  );
}
