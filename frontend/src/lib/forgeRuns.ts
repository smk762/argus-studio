/**
 * Pure helpers for /forge's training runs panel (argus-studio#122): which run is
 * live, how runs are ordered, and the bounded log a run's NDJSON stream builds.
 */

import type { ForgeRunEvent, ForgeRunRequest, ForgeRunState, ForgeRunStatus } from "@/lib/forgeApi";

/** Lines kept per run log: forge itself replays at most 2000 buffered events. */
export const LOG_LIMIT = 2000;

export const RUN_STATUS_LABEL: Record<ForgeRunStatus, string> = {
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** The run forge is training (or queued to train) now, if any. Studio refuses a second one; forge does too since argus-forge#62. */
export function activeRun(runs: readonly ForgeRunState[]): ForgeRunState | null {
  return runs.find((run) => run.status === "running") ?? null;
}

/** Newest first. Forge lists oldest first; ISO-8601 UTC timestamps sort as strings. */
export function newestFirst(runs: readonly ForgeRunState[]): ForgeRunState[] {
  return runs
    .map((run, index) => ({ run, index }))
    .sort((a, b) => (a.run.started_at === b.run.started_at ? b.index - a.index : a.run.started_at < b.run.started_at ? 1 : -1))
    .map(({ run }) => run);
}

/** The run to show when none is chosen: the live one, else the newest. */
export function defaultRun(runs: readonly ForgeRunState[]): ForgeRunState | null {
  return activeRun(runs) ?? newestFirst(runs)[0] ?? null;
}

/** The log line an event adds, or null for one that adds nothing. */
export function eventLine(event: ForgeRunEvent): string | null {
  switch (event.type) {
    case "start":
      return event.command?.length ? `$ ${event.command.join(" ")}` : "Started";
    case "log":
      return event.message ?? "";
    case "exit":
      return `Exited with code ${event.returncode ?? "?"}`;
    case "error":
      return `Error: ${event.message ?? "the run failed"}`;
    case "cancelled":
      return `Cancelled${event.message ? `: ${event.message}` : ""}`;
    default:
      return null;
  }
}

/** Append an event's line, keeping the last {@link LOG_LIMIT}. Returns a new array. */
export function appendLog(lines: readonly string[], event: ForgeRunEvent, limit = LOG_LIMIT): string[] {
  const line = eventLine(event);
  if (line === null) return lines as string[];
  const next = [...lines, line];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** "45s", "3m 12s", "1h 04m": from started_at to ended_at, or to `now` while running. */
export function runDuration(run: Pick<ForgeRunState, "started_at" | "ended_at">, now: number): string {
  const start = Date.parse(run.started_at);
  const end = run.ended_at ? Date.parse(run.ended_at) : now;
  if (Number.isNaN(start) || Number.isNaN(end)) return "";
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/**
 * Why Start is unavailable, or null when it can go. Ordered by what the user
 * can do about it: the form first, then the server.
 */
export function startBlockedReason(opts: {
  exportDir: string;
  atRoot: boolean;
  runnable: boolean;
  trainerLabel: string;
  active: ForgeRunState | null;
}): string | null {
  if (!opts.exportDir) return "Name an export dir above first.";
  if (opts.atRoot) return "Pick an export inside the export root, not the root itself.";
  if (!opts.runnable) return `${opts.trainerLabel} has no training script to run here; it is driven from its own UI.`;
  if (opts.active) return "A run is in progress. Wait for it to finish or cancel it first.";
  return null;
}

/**
 * A fresh `Idempotency-Key`: a random v4 UUID. `crypto.randomUUID` exists only
 * in a secure context, and Studio is often opened over plain HTTP on a LAN, so
 * the same UUID is built from `getRandomValues` (available everywhere) when it
 * is missing.
 */
export function newIdempotencyKey(c: Pick<Crypto, "getRandomValues"> & Partial<Pick<Crypto, "randomUUID">> = globalThis.crypto): string {
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = c.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** One user confirmation of a training run: what it asked for and the key every send of it carries. */
export interface RunAttempt {
  key: string;
  export_dir: string;
  trainer: ForgeRunRequest["trainer"];
}

/**
 * The attempt a press of Start sends. A resend of the same confirmation (the
 * previous send failed or its answer was lost) reuses its key, so forge can
 * answer with the run it already started; anything else (no attempt yet, or the
 * form now names another export or trainer) is a new confirmation with a new key.
 */
export function attemptFor(
  prev: RunAttempt | null,
  req: ForgeRunRequest,
  mint: () => string = newIdempotencyKey,
): RunAttempt {
  if (prev && prev.export_dir === req.export_dir && prev.trainer === req.trainer) return prev;
  return { key: mint(), export_dir: req.export_dir, trainer: req.trainer };
}
