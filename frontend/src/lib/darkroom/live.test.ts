import { describe, expect, it } from "vitest";

import { fixtureRecord } from "./fixture.test-util";
import { IDLE, isRunning, liveReducer, scannedCount, type LiveState } from "./live";
import type { Cell, GenerateRequest, Preflight } from "@/lib/darkroomApi";

const request: GenerateRequest = {
  user_prompt: "a lemon",
  negative_prompt: "",
  expand: false,
  enforcing_policy: "adult-granular",
  advisory_policies: ["default", "adult-granular"],
  thinking: "cascade",
  checkpoint: "x",
  loras: [],
  seed: null,
  sampling: { sampler: "euler", scheduler: "normal", steps: 4, cfg: 5, clip_skip: 1, width: 512, height: 512 },
  nsfw_threshold: 0.2,
};

const safe: Cell = { state: "safe", result: { safe: true, rules: [], explanation: null, model: null, thinking: "fast" }, error: null };
const flagged: Cell = { state: "flagged", result: { safe: false, rules: ["B. Crimes"], explanation: "why", model: null, thinking: "slow" }, error: null };

const preflight = (outcome: Preflight["outcome"]): Preflight => ({
  mode: "nsfw",
  enforcing_policy: "adult-granular",
  advisory_policies: ["default"],
  thinking: "cascade",
  user_prompt: "a lemon",
  expanded_prompt: null,
  final_prompt: "a lemon",
  negative_prompt: "",
  framed_text: "",
  outcome,
  refusal: null,
  warnings: [],
  results: { "adult-granular": safe, default: safe },
});

describe("live reducer", () => {
  it("lays out the grid from the request, enforcing first and without repeats", () => {
    const state = liveReducer(IDLE, { type: "start", request });
    expect(state.phase).toBe("preflight");
    expect(state.policies).toEqual(["adult-granular", "default"]);
    expect(scannedCount(state)).toEqual({ done: 0, total: 4 });
    expect(isRunning(state)).toBe(true);
  });

  it("moves through queued, rendering and scanning as events arrive, filling cells one by one", () => {
    let state: LiveState = liveReducer(IDLE, { type: "start", request });
    state = liveReducer(state, { type: "preflight", preflight: preflight("ok") });
    expect(state.phase).toBe("queued");
    state = liveReducer(state, { type: "progress", progress: { step: 2, total: 4 } });
    expect(state.phase).toBe("rendering");
    state = liveReducer(state, { type: "scan", scan: { policy: "adult-granular", context: "isolated", cell: safe } });
    state = liveReducer(state, { type: "scan", scan: { policy: "adult-granular", context: "with_prompt", cell: flagged } });
    expect(state.phase).toBe("scanning");
    expect(scannedCount(state)).toEqual({ done: 2, total: 4 });
    expect(state.cells["adult-granular"].with_prompt?.state).toBe("flagged");
    expect(state.cells.default.isolated).toBeNull();
    const record = fixtureRecord("fx-review-disagree");
    state = liveReducer(state, { type: "complete", record });
    expect(state.phase).toBe("complete");
    expect(state.record?.id).toBe("fx-review-disagree");
    expect(isRunning(state)).toBe(false);
  });

  it("replaces the delivered record when darkroom changes it, and ignores any other", () => {
    const record = fixtureRecord("fx-passed");
    const state = liveReducer({ ...IDLE, phase: "complete", record }, { type: "record", record: { ...record, removed_at: "2026-11-07T00:00:00Z" } });
    expect(state.record?.removed_at).toBe("2026-11-07T00:00:00Z");
    expect(liveReducer(state, { type: "record", record: fixtureRecord("fx-failed") })).toBe(state);
  });

  // Audit pack-argus-studio-db1105a0bb: a refusal ends the run rather than leaving it "running".
  it("finishes when the verdict refuses, and still records a later error", () => {
    let state = liveReducer(IDLE, { type: "start", request });
    state = liveReducer(state, { type: "preflight", preflight: preflight("refused") });
    expect(state.phase).toBe("complete");
    expect(isRunning(state)).toBe(false);
    state = liveReducer(state, { type: "error", error: "boom" });
    expect(state.phase).toBe("error");
    expect(state.error).toBe("boom");
    expect(liveReducer(state, { type: "reset" })).toEqual(IDLE);
  });

  // Audit pack-argus-studio-e3a04d6055: a straggler event can't revive a finished, failed or cleared run.
  it.each(["idle", "complete", "error"] as const)("ignores queued/progress/scan once %s", (phase) => {
    const state: LiveState = { ...IDLE, phase };
    expect(liveReducer(state, { type: "queued" })).toBe(state);
    expect(liveReducer(state, { type: "progress", progress: { step: 1, total: 10 } } as never)).toBe(state);
    expect(liveReducer(state, { type: "scan", scan: { policy: "default", context: "isolated", cell: safe } } as never)).toBe(state);
    expect(isRunning(liveReducer(state, { type: "queued" }))).toBe(false);
  });

  // Audit pack-argus-studio-6edd014758: a late verdict is a straggler too, and must not clear a finished grid.
  it.each(["idle", "complete", "error"] as const)("ignores a late preflight once %s", (phase) => {
    const state: LiveState = { ...IDLE, phase, policies: ["default"], cells: { default: { isolated: safe, with_prompt: null } } };
    const after = liveReducer(state, { type: "preflight", preflight: preflight("ok") });
    expect(after).toBe(state);
    expect(isRunning(after)).toBe(false);
  });
});
