import { describe, expect, it } from "vitest";
import type { ForgeRunState } from "@/lib/forgeApi";
import {
  activeRun,
  appendLog,
  attemptFor,
  defaultRun,
  eventLine,
  newIdempotencyKey,
  newestFirst,
  requestSequence,
  runDuration,
  startBlockedReason,
} from "@/lib/forgeRuns";

const run = (id: string, started_at: string, status: ForgeRunState["status"] = "succeeded"): ForgeRunState => ({
  run_id: id,
  trainer: "kohya",
  export_dir: "/data/out/set",
  status,
  started_at,
  ended_at: status === "running" ? null : started_at,
  returncode: null,
  command: [],
  cwd: null,
  message: null,
});

describe("run ordering", () => {
  const runs = [run("a", "2026-11-15T10:00:00Z"), run("b", "2026-11-15T11:00:00Z", "running"), run("c", "2026-11-15T09:00:00Z")];

  it("finds the live run", () => {
    expect(activeRun(runs)?.run_id).toBe("b");
    expect(activeRun([runs[0]])).toBeNull();
  });

  it("orders newest first, later-listed first on a tie", () => {
    expect(newestFirst(runs).map((r) => r.run_id)).toEqual(["b", "a", "c"]);
    const tie = [run("x", "2026-11-15T10:00:00Z"), run("y", "2026-11-15T10:00:00Z")];
    expect(newestFirst(tie).map((r) => r.run_id)).toEqual(["y", "x"]);
  });

  it("defaults to the live run, else the newest", () => {
    expect(defaultRun(runs)?.run_id).toBe("b");
    expect(defaultRun([runs[0], runs[2]])?.run_id).toBe("a");
    expect(defaultRun([])).toBeNull();
  });
});

describe("run log", () => {
  it("renders each event type", () => {
    expect(eventLine({ run_id: "r", type: "start", command: ["bash", "train.sh"] })).toBe("$ bash train.sh");
    expect(eventLine({ run_id: "r", type: "log", message: "step 10/100" })).toBe("step 10/100");
    expect(eventLine({ run_id: "r", type: "log" })).toBe("");
    expect(eventLine({ run_id: "r", type: "exit", returncode: 1 })).toBe("Exited with code 1");
    expect(eventLine({ run_id: "r", type: "error", message: "boom" })).toBe("Error: boom");
    expect(eventLine({ run_id: "r", type: "cancelled" })).toBe("Cancelled");
    expect(eventLine({ run_id: "r", type: "future" } as never)).toBeNull();
  });

  it("keeps the last lines only", () => {
    let lines: string[] = [];
    for (let i = 0; i < 5; i++) lines = appendLog(lines, { run_id: "r", type: "log", message: `l${i}` }, 3);
    expect(lines).toEqual(["l2", "l3", "l4"]);
  });

  it("ignores an unknown event without copying", () => {
    const lines = ["a"];
    expect(appendLog(lines, { run_id: "r", type: "future" } as never)).toBe(lines);
  });
});

describe("runDuration", () => {
  const start = "2026-11-15T10:00:00Z";
  const at = (s: number) => Date.parse(start) + s * 1000;

  it("formats seconds, minutes and hours", () => {
    expect(runDuration({ started_at: start, ended_at: null }, at(45))).toBe("45s");
    expect(runDuration({ started_at: start, ended_at: null }, at(192))).toBe("3m 12s");
    expect(runDuration({ started_at: start, ended_at: null }, at(3840))).toBe("1h 04m");
  });

  it("uses ended_at once finished, and tolerates bad dates", () => {
    expect(runDuration({ started_at: start, ended_at: "2026-11-15T10:01:00Z" }, at(9999))).toBe("1m 00s");
    expect(runDuration({ started_at: "nope", ended_at: null }, at(1))).toBe("");
  });
});

describe("startBlockedReason", () => {
  const ok = { exportDir: "/data/out/set", atRoot: false, runnable: true, trainerLabel: "kohya", active: null };

  it("allows a runnable trainer on an export with nothing running", () => {
    expect(startBlockedReason(ok)).toBeNull();
  });

  it("names the first blocker", () => {
    expect(startBlockedReason({ ...ok, exportDir: "" })).toMatch(/export dir/);
    expect(startBlockedReason({ ...ok, atRoot: true })).toMatch(/root/);
    expect(startBlockedReason({ ...ok, runnable: false, trainerLabel: "OneTrainer" })).toMatch(/OneTrainer/);
    expect(startBlockedReason({ ...ok, active: run("b", "2026-11-15T11:00:00Z", "running") })).toMatch(/in progress/);
  });
});

describe("Idempotency-Key per confirmation", () => {
  const req = { export_dir: "/data/out/set", trainer: "kohya" as const };
  const counter = () => {
    let n = 0;
    return () => `key-${++n}`;
  };

  it("mints a key on a confirmation's first send and reuses it for every resend", () => {
    const mint = counter();
    const first = attemptFor(null, req, mint);
    expect(first.key).toBe("key-1");
    const retry = attemptFor(first, req, mint);
    expect(retry).toBe(first);
    expect(attemptFor(retry, { ...req }, mint).key).toBe("key-1");
  });

  it("a new confirmation, or new parameters, gets a new key", () => {
    const mint = counter();
    const first = attemptFor(null, req, mint);
    expect(attemptFor(null, req, mint).key).toBe("key-2");
    expect(attemptFor(first, { ...req, export_dir: "/data/out/other" }, mint).key).toBe("key-3");
    expect(attemptFor(first, { ...req, trainer: "onetrainer" }, mint).key).toBe("key-4");
  });

  it("keys are random v4 UUIDs, from getRandomValues where randomUUID is missing (plain HTTP)", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(newIdempotencyKey()).toMatch(uuid);
    const insecure: Pick<Crypto, "getRandomValues"> = { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) };
    const a = newIdempotencyKey(insecure);
    const b = newIdempotencyKey(insecure);
    expect(a).toMatch(uuid);
    expect(a).not.toBe(b);
    // forge accepts 1-200 printable ASCII characters.
    expect(a).toMatch(/^[\x20-\x7e]{1,200}$/);
  });
});

// Audit pack-argus-studio-428076bba8: a poll sent before a Start must not answer after it.
describe("requestSequence", () => {
  it("lets only the newest request's answer land", () => {
    const turns = requestSequence();
    const poll = turns.next();
    const reread = turns.next();
    expect(poll()).toBe(false);
    expect(reread()).toBe(true);
  });

  it("retires every turn in flight when a local update supersedes them", () => {
    const turns = requestSequence();
    const poll = turns.next();
    turns.supersede();
    expect(poll()).toBe(false);
    expect(turns.next()()).toBe(true);
  });
});
