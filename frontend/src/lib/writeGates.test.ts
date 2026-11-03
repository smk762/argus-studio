import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The write fetchers gate themselves on the server's /health (argus-studio#75).
// Each test re-imports the clients so their remembered health starts empty, and
// a stub fetch records every request: a refused write must never reach the wire.

type Route = (init?: RequestInit) => Response;
let routes: Record<string, Route>;
let calls: string[];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
/** A write that got past the gate: its failure proves the request was sent. */
const sent: Route = () => json({ detail: "reached the server" }, 500);

beforeEach(() => {
  vi.resetModules();
  routes = {};
  calls = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${new URL(url).pathname}`;
    calls.push(key);
    init?.signal?.throwIfAborted();
    const route = routes[key];
    if (!route) throw new TypeError("Failed to fetch");
    return route(init);
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("proof writes", () => {
  it("refuses a review on a read-only server without sending it", async () => {
    routes["GET /health"] = () => json({ status: "ok", service: "argus-proof", version: "0.2.1", read_only: true });
    routes["POST /report/r1/hitl"] = sent;
    const { submitHitl } = await import("@/lib/proofApi");
    const { CapabilityRefused } = await import("@/lib/capabilities");

    const err = await submitHitl("r1", { updates: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(CapabilityRefused);
    expect(err.denied).toBe(true);
    expect(calls).toEqual(["GET /health"]);
  });

  it("probes /health on demand, then sends the write", async () => {
    routes["GET /health"] = () => json({ status: "ok", service: "argus-proof", version: "0.2.1", read_only: false });
    routes["POST /run/stream"] = sent;
    const { runEvalStream } = await import("@/lib/proofApi");

    await expect(runEvalStream({} as never, () => {})).rejects.toThrow("reached the server");
    expect(calls).toEqual(["GET /health", "POST /run/stream"]);
  });

  it("reuses the health a page already fetched", async () => {
    routes["GET /health"] = () => json({ status: "ok", service: "argus-proof", version: "0.2.1" });
    routes["POST /report/r1/hitl"] = sent;
    const { getProofHealth, submitHitl } = await import("@/lib/proofApi");

    await getProofHealth();
    await expect(submitHitl("r1", { updates: [] })).rejects.toThrow("reached the server");
    expect(calls).toEqual(["GET /health", "POST /report/r1/hitl"]);
  });

  it("fails safe when /health is unreachable", async () => {
    routes["POST /report/r1/hitl"] = sent;
    const { submitHitl } = await import("@/lib/proofApi");

    const err = await submitHitl("r1", { updates: [] }).catch((e) => e);
    expect(err.denied).toBe(false);
    expect(err.message).toMatch(/unreachable/);
    expect(calls).toEqual(["GET /health"]);
  });

  it("propagates a caller's abort rather than reporting the server unreachable", async () => {
    const { submitHitl } = await import("@/lib/proofApi");
    const ctrl = new AbortController();
    ctrl.abort();
    const err = await submitHitl("r1", { updates: [] }, ctrl.signal).catch((e) => e);
    expect(err.name).toBe("AbortError");
  });
});

describe("curator export", () => {
  const curator = (extra: object) => () =>
    json({ status: "ok", service: "argus-curator", version: "0.3.0", manifest_version: "2.1", ...extra });
  const request = (mode: "copy" | "move") =>
    ({ scan_id: "s", selection: [], dest: "out", mode, preserve_structure: true }) as never;

  it("refuses a move the server disallows, but lets a copy through", async () => {
    routes["GET /health"] = curator({ allow_move: false, export_root: "/data/out" });
    routes["POST /export/stream"] = sent;
    const { exportSelectionStream } = await import("@/lib/curatorApi");

    await expect(exportSelectionStream(request("move"), () => {})).rejects.toThrow(/move exports/);
    expect(calls).not.toContain("POST /export/stream");
    await expect(exportSelectionStream(request("copy"), () => {})).rejects.toThrow("reached the server");
  });

  it("refuses an unreadable manifest major before anything moves", async () => {
    routes["GET /health"] = curator({ allow_move: true, manifest_version: "3.0" });
    routes["POST /export/stream"] = sent;
    const { exportSelectionStream } = await import("@/lib/curatorApi");

    await expect(exportSelectionStream(request("move"), () => {})).rejects.toThrow(/manifest major/);
    expect(calls).toEqual(["GET /health"]);
  });

  it("refuses every export without an export root", async () => {
    routes["GET /health"] = curator({ export_root: null });
    const { exportSelectionStream } = await import("@/lib/curatorApi");
    await expect(exportSelectionStream(request("copy"), () => {})).rejects.toThrow(/export root/);
  });
});

describe("forge, atlas and quarry writes", () => {
  it("forge: a dry-run preview is never gated; a write is", async () => {
    routes["GET /health"] = () => json({ status: "ok", service: "argus-forge", version: "0.1.1", training: "disabled" });
    routes["POST /config"] = sent;
    const { forgeConfig } = await import("@/lib/forgeApi");

    await expect(forgeConfig({ dry_run: true } as never)).rejects.toThrow("reached the server");
    expect(calls).toEqual(["POST /config"]);
    await expect(forgeConfig({ dry_run: false } as never)).rejects.toThrow(/demo-safe/);
    expect(calls).toEqual(["POST /config", "GET /health"]);
  });

  it("atlas: baking is refused unless the host enables it", async () => {
    routes["GET /health"] = () => json({ status: "ok", service: "argus-atlas", version: "0.1.0", read_only: true });
    routes["POST /bake/stream"] = sent;
    const { bakeStream } = await import("@/lib/atlasApi");
    await expect(bakeStream({ job_id: "j", checkpoint: "c" }, () => {})).rejects.toThrow(/ATLAS_ALLOW_BAKE/);
    expect(calls).toEqual(["GET /health"]);
  });

  it("quarry: a server that never advertised fetch_allowed is refused", async () => {
    routes["GET /health"] = () => json({ status: "ok", service: "argus-quarry", version: "0.2.3", quarry_home: "/q" });
    routes["POST /archives/pd12m/fetch"] = sent;
    const { fetchSlice, getQuarryHealth } = await import("@/lib/galleryApi");
    const spec = { archive: "pd12m" } as never;

    await expect(fetchSlice(spec, () => {})).rejects.toThrow(/QUARRY_ALLOW_FETCH/);
    routes["GET /health"] = () => json({ status: "ok", service: "argus-quarry", version: "0.3.1", quarry_home: "/q", fetch_allowed: true });
    await getQuarryHealth();
    await expect(fetchSlice(spec, () => {})).rejects.toThrow("reached the server");
  });
});
