"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CapabilityNotice } from "@/components/CapabilityNotice";
import { permits, type Capability } from "@/lib/capabilities";
import {
  cancelRun,
  listRuns,
  RunInProgress,
  RunKeyConflict,
  startRun,
  streamRun,
  TRAINER_LABELS,
  type ForgeRunEvent,
  type ForgeRunState,
  type TrainerId,
} from "@/lib/forgeApi";
import {
  activeRun,
  attemptFor,
  defaultRun,
  eventLine,
  LOG_LIMIT,
  newestFirst,
  RUN_STATUS_LABEL,
  RunListOrder,
  runDuration,
  startBlockedReason,
  type RunAttempt,
} from "@/lib/forgeRuns";

/** How often the run list refreshes, for runs started from the CLI or another tab. */
const POLL_MS = 10_000;

/** Log events are batched into one state update per this window: a trainer can print many lines a second. */
const LOG_FLUSH_MS = 100;

const NO_LINES: string[] = [];

const STATUS_TONE: Record<ForgeRunState["status"], string> = {
  running: "border-accent-amber/40 bg-accent-amber/10 text-accent-amber-ink",
  succeeded: "border-accent-teal/40 bg-accent-teal/10 text-accent-teal-ink",
  failed: "border-accent-red/40 bg-accent-red/10 text-accent-red-ink",
  cancelled: "border-border bg-surface-hover text-muted",
};

const PRIMARY =
  "cursor-pointer rounded-lg bg-accent-amber px-4 py-1.5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const DANGER =
  "cursor-pointer rounded-md border border-accent-red/40 px-2.5 py-1 text-xs text-accent-red-ink transition-colors hover:bg-accent-red/10 disabled:cursor-not-allowed disabled:opacity-40";
const PLAIN =
  "cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-40";

type Pending = { kind: "start" } | { kind: "cancel"; runId: string } | null;

/**
 * Live training on /forge (argus-studio#122): start the written config for the
 * export the form names, follow its log, cancel it, and browse the runs this
 * forge process remembers. Rendered only against a live, reachable forge; the
 * list is readable on a demo-safe host too, while Start and Cancel follow
 * `/health.training` (and the client refuses them besides, #75).
 */
export function TrainingRuns({
  exportDir,
  atRoot,
  trainer,
  runnable,
  training,
}: {
  exportDir: string;
  atRoot: boolean;
  trainer: TrainerId;
  /** The trainer emits a runnable entrypoint (forge's /trainers `entrypoint`). */
  runnable: boolean;
  training: Capability;
}) {
  const [runs, setRuns] = useState<ForgeRunState[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [log, setLog] = useState<{ runId: string; lines: string[] } | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The open Start confirmation's Idempotency-Key, minted on its first send and
  // reused by every resend of it; cleared when the confirmation ends (started,
  // dismissed, or refused with a 409). Component state only: nothing in /forge
  // survives a page load, so neither does a key.
  const [attempt, setAttempt] = useState<RunAttempt | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const canTrain = permits(training);
  const active = runs ? activeRun(runs) : null;
  const ordered = runs ? newestFirst(runs) : [];
  const selected = runs?.find((run) => run.run_id === chosen) ?? (runs ? defaultRun(runs) : null);
  const selectedId = selected?.run_id ?? null;
  const blocked = startBlockedReason({ exportDir, atRoot, runnable, trainerLabel: TRAINER_LABELS[trainer], active });

  const listOrder = useRef(new RunListOrder());
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const request = listOrder.current.send();
    try {
      const next = await listRuns(signal);
      if (signal?.aborted || !listOrder.current.accept(request)) return;
      setRuns(next);
      setListError(null);
    } catch (caught) {
      if (signal?.aborted || !listOrder.current.accept(request)) return;
      setListError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  // The run list: on mount, then on a slow poll. Fetch-only effect.
  useEffect(() => {
    const ctrl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches the run list; state is set from the response
    void refresh(ctrl.signal);
    const timer = setInterval(() => void refresh(ctrl.signal), POLL_MS);
    return () => {
      ctrl.abort();
      clearInterval(timer);
    };
  }, [refresh]);

  // The selected run's log: forge replays its buffer, then follows the run live
  // and closes the stream when it ends, at which point the list is refreshed for
  // the final status. Events are queued and flushed in batches, so a chatty
  // trainer costs one array copy and one render per flush, not per line.
  useEffect(() => {
    if (!selectedId) return;
    const ctrl = new AbortController();
    let queue: ForgeRunEvent[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = (extra: string[] = []) => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      const added = [...queue.map(eventLine).filter((line): line is string => line !== null), ...extra];
      queue = [];
      if (added.length === 0) return;
      setLog((cur) => {
        if (!cur || cur.runId !== selectedId) return cur;
        const next = [...cur.lines, ...added];
        return { runId: selectedId, lines: next.length > LOG_LIMIT ? next.slice(next.length - LOG_LIMIT) : next };
      });
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the log for the stream this effect opens
    setLog({ runId: selectedId, lines: [] });
    streamRun(
      selectedId,
      (event) => {
        queue.push(event);
        timer ??= setTimeout(() => flush(), LOG_FLUSH_MS);
      },
      ctrl.signal,
    )
      .then(() => {
        if (ctrl.signal.aborted) return;
        flush();
        void refresh(ctrl.signal);
      })
      .catch((caught) => {
        if (ctrl.signal.aborted) return;
        flush([`(log stream lost: ${caught instanceof Error ? caught.message : String(caught)})`]);
      });
    return () => {
      ctrl.abort();
      if (timer !== null) clearTimeout(timer);
    };
  }, [selectedId, refresh]);

  // A ticking clock only while something is running, for its elapsed time.
  const running = active !== null;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  // Follow the log's tail unless the reader has scrolled up to read.
  const logRef = useRef<HTMLPreElement>(null);
  const pinned = useRef(true);
  const lines = log && log.runId === selectedId ? log.lines : NO_LINES;
  useEffect(() => {
    const el = logRef.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (pending.kind === "start") {
        const req = { export_dir: exportDir, trainer };
        const sending = attemptFor(attempt, req);
        setAttempt(sending);
        setConflict(false);
        const { run: started, replayed } = await startRun(req, sending.key);
        setAttempt(null);
        if (replayed) setNotice(`Already started: run ${started.run_id.slice(0, 8)} came from an earlier send of this request.`);
        // List the new run at once, so the selection (and its log stream) moves
        // straight to it rather than reopening another run's log until the
        // refresh below lands. A poll already in flight may not know the run yet.
        listOrder.current.supersede();
        setRuns((cur) => (cur?.some((run) => run.run_id === started.run_id) ? cur : [...(cur ?? []), started]));
        setChosen(started.run_id);
        pinned.current = true;
      } else {
        await cancelRun(pending.runId);
      }
      setPending(null);
      await refresh();
    } catch (caught) {
      if (caught instanceof RunKeyConflict) {
        // Forge refused the key: the next press is a deliberate new run, so it mints a new one.
        setAttempt(null);
        setConflict(true);
      } else if (caught instanceof RunInProgress) {
        // Possibly this confirmation's own run, started by a send whose answer was lost: show it.
        // Its key stays: forge's own `run_active` refusal (RunActiveRefused) records no key, so
        // pressing Retry once that run ends sends this confirmation again and starts it.
        setChosen(caught.runId);
        pinned.current = true;
        void refresh();
      }
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  // A new confirmation starts with no key; its first send mints one.
  const openStart = () => {
    setAttempt(null);
    setConflict(false);
    setError(null);
    setNotice(null);
    setPending({ kind: "start" });
  };
  const dismissStart = () => {
    setAttempt(null);
    setConflict(false);
    setPending(null);
  };

  return (
    <div className="space-y-4">
      {/* Start */}
      {canTrain && (
        <div className="space-y-2">
          {pending?.kind === "start" ? (
            <div role="group" aria-label="Confirm starting training" className="space-y-2 text-xs text-foreground/80">
              <p>
                Train <span className="font-mono">{exportDir}</span> with {TRAINER_LABELS[trainer]}? It runs the written{" "}
                <span className="font-mono">forge/{trainer}/train.sh</span> on this host&apos;s GPU until it finishes or you cancel it.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void confirm()} disabled={busy} className={PRIMARY}>
                  {busy ? "Starting…" : conflict ? "Start a new run" : attempt ? "Retry" : "Start training"}
                </button>
                <button type="button" onClick={dismissStart} disabled={busy} className={PLAIN} autoFocus>
                  Not now
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={openStart} disabled={blocked !== null || busy} className={PRIMARY}>
                Train with {TRAINER_LABELS[trainer]}
              </button>
              <span className="text-[11px] text-muted">
                {blocked ?? "Runs the config written into this export (Generate + write above)."}
              </span>
            </div>
          )}
        </div>
      )}

      {error && <CapabilityNotice reason={error} />}
      {notice && (
        <p role="status" className="text-xs text-muted">
          {notice}
        </p>
      )}
      {listError && <CapabilityNotice reason={`Couldn't list runs: ${listError}`} />}

      {/* Runs */}
      {runs === null ? (
        !listError && <p className="text-xs text-muted">Loading runs…</p>
      ) : ordered.length === 0 ? (
        <p className="text-xs text-muted">No runs yet. This forge forgets its runs when it restarts.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          <ul className="space-y-1.5" aria-label="Training runs">
            {ordered.map((run) => {
              const current = run.run_id === selectedId;
              return (
                <li key={run.run_id}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(run.run_id);
                      pinned.current = true;
                    }}
                    aria-current={current ? "true" : undefined}
                    className={`w-full cursor-pointer rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      current ? "border-accent-amber/50 bg-surface-hover" : "border-border hover:bg-surface-hover"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-foreground">{run.run_id.slice(0, 8)}</span>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${STATUS_TONE[run.status]}`}>
                        {RUN_STATUS_LABEL[run.status]}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-muted" title={run.export_dir}>
                      {TRAINER_LABELS[run.trainer]} · {run.export_dir.split("/").filter(Boolean).at(-1) ?? run.export_dir}
                    </span>
                    <span className="block text-muted">{runDuration(run, now)}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected && (
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 text-xs">
                  {/* Polite and short: the final status is the one update worth announcing. */}
                  <p role="status" className="font-medium text-foreground">
                    {RUN_STATUS_LABEL[selected.status]}
                    {selected.returncode !== null && ` (exit ${selected.returncode})`}
                    {selected.message && <span className="font-normal text-muted"> · {selected.message}</span>}
                  </p>
                  <p className="truncate font-mono text-[11px] text-muted" title={selected.export_dir}>
                    {selected.export_dir}
                  </p>
                </div>
                {selected.status === "running" &&
                  canTrain &&
                  (pending?.kind === "cancel" && pending.runId === selected.run_id ? (
                    <div role="group" aria-label="Confirm cancelling the run" className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-foreground/80">Stop it? Progress since the last saved checkpoint is lost.</span>
                      <button type="button" onClick={() => void confirm()} disabled={busy} className={DANGER}>
                        {busy ? "Cancelling…" : "Cancel run"}
                      </button>
                      <button type="button" onClick={() => setPending(null)} disabled={busy} className={PLAIN} autoFocus>
                        Keep training
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setPending({ kind: "cancel", runId: selected.run_id })} className={DANGER}>
                      Cancel…
                    </button>
                  ))}
              </div>
              {/* Passive: a training log changes many times a second, so it is
                  never a live region; the status line above announces the end. */}
              <pre
                ref={logRef}
                tabIndex={0}
                role="region"
                aria-label={`Log for run ${selected.run_id.slice(0, 8)}`}
                aria-live="off"
                onScroll={(event) => {
                  const el = event.currentTarget;
                  pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
                }}
                className="h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground/90 focus:outline-none focus:ring-1 focus:ring-accent-amber/50"
              >
                {lines.length ? lines.join("\n") : "Waiting for output…"}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
