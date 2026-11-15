/**
 * Pure helpers for /forge's training runs panel (argus-studio#122): which run is
 * live, how runs are ordered, and the bounded log a run's NDJSON stream builds.
 */

import type { ForgeRunEvent, ForgeRunState, ForgeRunStatus } from "@/lib/forgeApi";

/** Lines kept per run log: forge itself replays at most 2000 buffered events. */
export const LOG_LIMIT = 2000;

export const RUN_STATUS_LABEL: Record<ForgeRunStatus, string> = {
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** The run forge is training now, if any. Forge doesn't refuse a second one; Studio does. */
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
