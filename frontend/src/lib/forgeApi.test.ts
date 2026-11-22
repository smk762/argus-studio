import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attemptFor } from "@/lib/forgeRuns";

// POST /run's Idempotency-Key (argus-forge#61): the header goes on the request,
// a resend of one confirmation repeats it, and forge's answers map to what the
// panel shows. A stub fetch records every request and its headers.

type Route = (init?: RequestInit) => Response | Promise<Response>;
let routes: Record<string, Route>;
let posts: Headers[];

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const run = { run_id: "abcdef123456", trainer: "kohya", export_dir: "/data/out/set", status: "running", started_at: "2026-11-22T10:00:00Z" };
const req = { export_dir: "/data/out/set", trainer: "kohya" as const };

beforeEach(() => {
  vi.resetModules();
  posts = [];
  routes = {
    "GET /health": () => json({ status: "ok", service: "argus-forge", version: "0.3.1", training: "enabled" }),
    "GET /runs": () => json([]),
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${new URL(url).pathname}`;
    if (key === "POST /run") posts.push(new Headers(init?.headers));
    const route = routes[key];
    if (!route) throw new TypeError("Failed to fetch");
    return route(init);
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("startRun's Idempotency-Key", () => {
  it("sends the key on the request", async () => {
    routes["POST /run"] = () => json(run, 202);
    const { startRun } = await import("@/lib/forgeApi");

    const started = await startRun(req, "key-1");
    expect(posts).toHaveLength(1);
    expect(posts[0].get("Idempotency-Key")).toBe("key-1");
    expect(posts[0].get("Content-Type")).toBe("application/json");
    expect(started).toMatchObject({ replayed: false, run: { run_id: "abcdef123456", message: null } });
  });

  it("a retry after a lost answer resends the same key, and a replay is a success", async () => {
    let first = true;
    routes["POST /run"] = () => {
      if (first) {
        first = false;
        throw new TypeError("Failed to fetch"); // the run started; the 202 never arrived
      }
      return json({ ...run, status: "succeeded" }, 202, { "Idempotent-Replayed": "true" });
    };
    const { startRun } = await import("@/lib/forgeApi");

    const attempt = attemptFor(null, req, () => "key-7");
    await expect(startRun(req, attempt.key)).rejects.toThrow("Failed to fetch");
    const retry = attemptFor(attempt, req, () => "never");
    const started = await startRun(req, retry.key);

    expect(posts.map((h) => h.get("Idempotency-Key"))).toEqual(["key-7", "key-7"]);
    expect(started.replayed).toBe(true);
    expect(started.run.run_id).toBe("abcdef123456");
  });

  it("an idempotency 409 (no code) is a RunKeyConflict that says nothing started", async () => {
    routes["POST /run"] = () =>
      json({ detail: "this Idempotency-Key was already used for a different request (run abc)" }, 409);
    const { startRun, RunKeyConflict } = await import("@/lib/forgeApi");

    const err = await startRun(req, "key-1").catch((e) => e);
    expect(err).toBeInstanceOf(RunKeyConflict);
    expect(err.status).toBe(409);
    expect(err.message).toMatch(/Nothing started/);
    expect(err.message).toMatch(/Start a new run/);
    expect(err.detail).toContain("different request");
  });

  it("a 422 surfaces as an ordinary error", async () => {
    routes["POST /run"] = () => json({ detail: "Idempotency-Key must be 1-200 printable ASCII characters" }, 422);
    const { startRun, RunKeyConflict } = await import("@/lib/forgeApi");

    const err = await startRun(req, "key-1").catch((e) => e);
    expect(err).not.toBeInstanceOf(RunKeyConflict);
    expect(err.status).toBe(422);
    expect(err.message).toContain("printable ASCII");
  });

  it("forge's run_active 409 is a RunInProgress naming the active run, not a key conflict", async () => {
    routes["POST /run"] = () =>
      json(
        {
          detail: "a run is already active (run 99887766aabb, queued or running); wait for it to finish or cancel it",
          code: "run_active",
          active_run: { run_id: "99887766aabb", status: "running" },
        },
        409,
      );
    const { startRun, RunInProgress, RunActiveRefused, RunKeyConflict } = await import("@/lib/forgeApi");

    const err = await startRun(req, "key-1").catch((e) => e);
    expect(err).toBeInstanceOf(RunInProgress);
    expect(err).toBeInstanceOf(RunActiveRefused);
    expect(err).not.toBeInstanceOf(RunKeyConflict);
    expect(err.runId).toBe("99887766aabb");
    expect(err.message).toBe(
      "A run is already active (run 99887766, queued or running). Wait for it to finish or cancel it.",
    );
    expect(err.message).not.toMatch(/Start a new run/);
  });

  it("a run_active refusal keeps the key: the retry of the same confirmation resends it and starts the run", async () => {
    let active = true;
    routes["POST /run"] = () =>
      active
        ? json({ detail: "a run is already active", code: "run_active", active_run: { run_id: "other1234567", status: "running" } }, 409)
        : json(run, 202);
    const { startRun, RunInProgress } = await import("@/lib/forgeApi");

    const attempt = attemptFor(null, req, () => "key-9");
    await expect(startRun(req, attempt.key)).rejects.toBeInstanceOf(RunInProgress);
    active = false; // the active run ended
    const started = await startRun(req, attemptFor(attempt, req, () => "never").key);

    expect(posts.map((h) => h.get("Idempotency-Key"))).toEqual(["key-9", "key-9"]);
    expect(started).toMatchObject({ replayed: false, run: { run_id: "abcdef123456" } });
  });

  it.each([
    ["not JSON", () => new Response("<html>conflict</html>", { status: 409, headers: { "content-type": "text/html" } })],
    ["a code without active_run", () => json({ detail: "x", code: "run_active" }, 409)],
    ["an active_run without a string run_id", () => json({ detail: "x", code: "run_active", active_run: { run_id: 7 } }, 409)],
    ["another code", () => json({ detail: "x", code: "something_else", active_run: { run_id: "abc" } }, 409)],
    ["a JSON array", () => json([{ code: "run_active" }], 409)],
  ])("a 409 whose body is %s is a RunKeyConflict", async (_label, route) => {
    routes["POST /run"] = route;
    const { startRun, RunInProgress, RunKeyConflict } = await import("@/lib/forgeApi");

    const err = await startRun(req, "key-1").catch((e) => e);
    expect(err).toBeInstanceOf(RunKeyConflict);
    expect(err).not.toBeInstanceOf(RunInProgress);
    expect(err.status).toBe(409);
  });

  it("the running-run pre-check still refuses before anything is sent", async () => {
    routes["GET /runs"] = () => json([run]);
    routes["POST /run"] = () => json(run, 202);
    const { startRun, RunInProgress } = await import("@/lib/forgeApi");

    await expect(startRun(req, "key-1")).rejects.toBeInstanceOf(RunInProgress);
    expect(posts).toHaveLength(0);
  });
});
