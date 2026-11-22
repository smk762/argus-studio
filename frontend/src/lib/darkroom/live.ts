import type { RowPair } from "./shields";
import type { GenerateRequest, GenerationRecord, Preflight, ProgressEvent, ScanContext, ScanEvent } from "@/lib/darkroomApi";

export type LivePhase = "idle" | "preflight" | "queued" | "rendering" | "scanning" | "complete" | "error";

/** One generation as the SSE stream reports it: the pre-flight verdict, the step bar, then the grid filling cell by cell. */
export interface LiveState {
  phase: LivePhase;
  request: GenerateRequest | null;
  enforcing: string;
  policies: string[];
  preflight: Preflight | null;
  progress: ProgressEvent | null;
  cells: Record<string, RowPair>;
  record: GenerationRecord | null;
  error: string | null;
}

export type LiveEvent =
  | { type: "start"; request: GenerateRequest }
  | { type: "preflight"; preflight: Preflight }
  | { type: "queued" }
  | { type: "progress"; progress: ProgressEvent }
  | { type: "scan"; scan: ScanEvent }
  | { type: "complete"; record: GenerationRecord }
  | { type: "record"; record: GenerationRecord }
  | { type: "error"; error: string }
  | { type: "reset" };

export const IDLE: LiveState = { phase: "idle", request: null, enforcing: "", policies: [], preflight: null, progress: null, cells: {}, record: null, error: null };

export const PHASE_LABEL: Record<LivePhase, string> = {
  idle: "Idle",
  preflight: "Pre-flight",
  queued: "Queued",
  rendering: "Rendering",
  scanning: "Scanning",
  complete: "Done",
  error: "Failed",
};

function emptyCells(policies: string[]): Record<string, RowPair> {
  return Object.fromEntries(policies.map((name) => [name, { isolated: null, with_prompt: null }]));
}

export function liveReducer(state: LiveState, event: LiveEvent): LiveState {
  switch (event.type) {
    case "start": {
      const policies = [event.request.enforcing_policy, ...event.request.advisory_policies.filter((name) => name !== event.request.enforcing_policy)];
      return { ...IDLE, phase: "preflight", request: event.request, enforcing: event.request.enforcing_policy, policies, cells: emptyCells(policies) };
    }
    case "preflight": {
      // Only `start` begins a run: a verdict landing after a reset, a failure or
      // the finish would otherwise leave the form "queued" with nothing coming.
      if (FINISHED.includes(state.phase)) return state;
      const policies = [event.preflight.enforcing_policy, ...event.preflight.advisory_policies.filter((name) => name !== event.preflight.enforcing_policy)];
      // A refusal ends the run: nothing is queued after it, so don't stay "running"
      // waiting for a follow-up event (the `complete` that may follow still lands).
      return { ...state, preflight: event.preflight, enforcing: event.preflight.enforcing_policy, policies, cells: emptyCells(policies), phase: event.preflight.outcome === "refused" ? "complete" : "queued" };
    }
    case "queued":
      if (FINISHED.includes(state.phase)) return state;
      return { ...state, phase: "queued" };
    case "progress":
      if (FINISHED.includes(state.phase)) return state;
      return { ...state, phase: "rendering", progress: event.progress };
    case "scan": {
      // A late event from a finished, failed or cleared run must not revive it.
      if (FINISHED.includes(state.phase)) return state;
      const { policy, context, cell } = event.scan;
      const pair = state.cells[policy] ?? { isolated: null, with_prompt: null };
      const policies = state.policies.includes(policy) ? state.policies : [...state.policies, policy];
      return { ...state, phase: "scanning", policies, cells: { ...state.cells, [policy]: { ...pair, [context]: cell } } };
    }
    case "complete":
      // A refused preflight leaves the run complete with no record; its `complete` still attaches one.
      if (settled(state)) return state;
      return { ...state, phase: "complete", record: event.record };
    case "record":
      return state.record?.id === event.record.id ? { ...state, record: event.record } : state;
    case "error":
      // An error from a closing stream must not fail a finished run, or revive one that was cleared.
      if (settled(state)) return state;
      return { ...state, phase: "error", error: event.error };
    case "reset":
      return IDLE;
  }
}

export function scannedCount(state: LiveState): { done: number; total: number } {
  const contexts: ScanContext[] = ["isolated", "with_prompt"];
  let done = 0;
  for (const name of state.policies) for (const context of contexts) if (state.cells[name]?.[context]) done += 1;
  return { done, total: state.policies.length * 2 };
}

export const RUNNING: readonly LivePhase[] = ["preflight", "queued", "rendering", "scanning"];
/** Phases a run doesn't leave on a stray progress event: only `start` begins another. */
const FINISHED: readonly LivePhase[] = ["idle", "complete", "error"];
export const isRunning = (state: LiveState): boolean => RUNNING.includes(state.phase);
/**
 * Nothing more can land on this run: cleared, failed, or complete with its record. A run a refused preflight
 * ended is complete without one, and still takes its `complete` and any error.
 */
const settled = (state: LiveState): boolean =>
  state.phase === "idle" || state.phase === "error" || (state.phase === "complete" && state.record != null);
