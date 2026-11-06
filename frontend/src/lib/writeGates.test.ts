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

describe("curator scan control", () => {
  const curator = (extra: object) => () =>
    json({ status: "ok", service: "argus-curator", version: "0.14.0", manifest_version: "2.1", ...extra });

  it("refuses stop and purge when the server does not advertise scan control", async () => {
    routes["GET /health"] = curator({ scan_control: false });
    routes["POST /scan/abc/cancel"] = sent;
    routes["POST /scans/purge"] = sent;
    const { cancelScan, purgeScans } = await import("@/lib/curatorApi");

    await expect(cancelScan("abc")).rejects.toThrow(/stop a running scan/);
    await expect(purgeScans()).rejects.toThrow(/purge/);
    expect(calls).toEqual(["GET /health"]);
  });

  it("treats a curator that omits scan_control as unable to stop", async () => {
    routes["GET /health"] = curator({});
    routes["POST /scan/abc/cancel"] = sent;
    const { cancelScan } = await import("@/lib/curatorApi");

    await expect(cancelScan("abc")).rejects.toThrow(/stop a running scan/);
    expect(calls).toEqual(["GET /health"]);
  });

  it("sends cancel and purge once the server allows them", async () => {
    routes["GET /health"] = curator({ scan_control: true });
    routes["POST /scan/abc/cancel"] = () => json({ scan_id: "abc", cancelling: true });
    routes["POST /scans/purge"] = () => json({ cancelled: null, deleted: [] });
    const { cancelScan, getHealth, purgeScans } = await import("@/lib/curatorApi");

    await getHealth();
    await cancelScan("abc");
    const purged = await purgeScans();
    expect(purged).toEqual({ cancelled: null, deleted: [] });
    expect(calls).toEqual(["GET /health", "POST /scan/abc/cancel", "POST /scans/purge"]);
  });

  it("refuses deleting a cached scan unless the server advertises scan_delete", async () => {
    routes["GET /health"] = curator({ scan_control: true });
    routes["DELETE /scan/abc"] = sent;
    const { deleteCachedScan, getHealth } = await import("@/lib/curatorApi");

    await expect(deleteCachedScan("abc")).rejects.toThrow(/delete a cached scan/);
    expect(calls).toEqual(["GET /health"]);

    routes["GET /health"] = curator({ scan_delete: true });
    await getHealth();
    await expect(deleteCachedScan("abc")).rejects.toThrow("reached the server");
    expect(calls).toEqual(["GET /health", "GET /health", "DELETE /scan/abc"]);
  });
});

describe("darkroom writes", () => {
  const darkroom = (extra: object) => json({ version: "0.1.0", backends: {}, ...extra });
  const request = { user_prompt: "a lake" } as never;
  const handlers = { onPreflight() {}, onQueued() {}, onProgress() {}, onScan() {} };

  it("refuses every write on a read-only server without sending it", async () => {
    routes["GET /health"] = () => darkroom({ read_only: true });
    routes["POST /preflight"] = sent;
    routes["POST /generate/stream"] = sent;
    routes["DELETE /record/r1"] = sent;
    const { generate, preflight, removeImage } = await import("@/lib/darkroomApi");
    const { CapabilityRefused } = await import("@/lib/capabilities");

    for (const write of [() => preflight(request), () => generate(request, handlers), () => removeImage("r1")]) {
      const err = await write().catch((e) => e);
      expect(err).toBeInstanceOf(CapabilityRefused);
      expect(err.denied).toBe(true);
    }
    expect(calls).toEqual(["GET /health"]);
  });

  it("refuses when /health can't be read", async () => {
    routes["POST /preflight"] = sent;
    const { preflight } = await import("@/lib/darkroomApi");

    const err = await preflight(request).catch((e) => e);
    expect(err.denied).toBe(false);
    expect(calls).toEqual(["GET /health"]);
  });

  it("sends a write when the server isn't read-only", async () => {
    routes["GET /health"] = () => darkroom({ read_only: false });
    routes["POST /preflight"] = sent;
    const { preflight } = await import("@/lib/darkroomApi");

    await expect(preflight(request)).rejects.toThrow("reached the server");
  });

  it("resolves with the record, and fails on a stream that ends without one", async () => {
    routes["GET /health"] = () => darkroom({ read_only: false });
    const frames = (text: string) => new Response(text, { headers: { "content-type": "text/event-stream" } });
    const scans: unknown[] = [];
    routes["POST /generate/stream"] = () =>
      frames('event: scan\ndata: {"policy":"default"}\n\nevent: complete\ndata: {"record":{"id":"r1"}}\n\n');
    const { generate } = await import("@/lib/darkroomApi");

    const record = await generate(request, { ...handlers, onScan: (scan) => scans.push(scan) });
    expect(record.id).toBe("r1");
    expect(scans).toEqual([{ policy: "default" }]);

    routes["POST /generate/stream"] = () => frames('event: error\ndata: {"detail":"no image was released"}\n\n');
    await expect(generate(request, handlers)).rejects.toThrow("no image was released");
describe("curator image delete", () => {
  const curator = (extra: object) => json({ status: "ok", service: "argus-curator", version: "0.14.1", ...extra });
  const plain = (rel_path: string) => ({ rel_path, passed: true, faces: [] }) as never;
  const flagged = (rel_path: string) =>
    ({
      rel_path,
      passed: true,
      faces: [{ primary: true, attributes: { age_years: 15, age_source: "mivolo" } }],
      nsfw: { exposed_score: 0.6 },
    }) as never;
  const sentPaths = (bodies: string[]) => bodies.map((body) => JSON.parse(body).rel_paths);
  let bodies: string[];
  const accept: Route = (init) => {
    bodies.push(String(init?.body));
    return json({ rel_paths: [], total: 0 });
  };

  beforeEach(() => {
    bodies = [];
  });

  it("refuses an ordinary frame without delete_any and sends nothing", async () => {
    routes["GET /health"] = () => curator({ delete_any: false });
    routes["POST /scan/s1/delete"] = accept;
    const { deleteScanImages } = await import("@/lib/curatorApi");
    const { CapabilityRefused } = await import("@/lib/capabilities");

    const err = await deleteScanImages("s1", [flagged("a"), plain("b")]).catch((e) => e);
    expect(err).toBeInstanceOf(CapabilityRefused);
    expect(calls).toEqual(["GET /health"]);
  });

  it("refuses everything on a server that predates the field", async () => {
    routes["GET /health"] = () => curator({});
    routes["POST /scan/s1/delete"] = accept;
    const { deleteScanImages } = await import("@/lib/curatorApi");

    await expect(deleteScanImages("s1", [flagged("a")])).rejects.toThrow("predates image delete");
    expect(calls).toEqual(["GET /health"]);
  });

  it("batches with delete_any", async () => {
    routes["GET /health"] = () => curator({ delete_any: true });
    routes["POST /scan/s1/delete"] = accept;
    const { deleteScanImages } = await import("@/lib/curatorApi");

    const rows = Array.from({ length: 201 }, (_, i) => plain(`${i}.jpg`));
    const outcome = await deleteScanImages("s1", rows);
    expect(outcome.deleted).toHaveLength(201);
    expect(sentPaths(bodies).map((paths) => paths.length)).toEqual([200, 1]);
  });

  it("sends flagged frames singly without delete_any, so one 403 keeps only that frame", async () => {
    routes["GET /health"] = () => curator({ delete_any: false });
    routes["POST /scan/s1/delete"] = (init) => {
      bodies.push(String(init?.body));
      return JSON.parse(String(init?.body)).rel_paths[0] === "b"
        ? json({ detail: "deleting this image is disabled" }, 403)
        : json({ rel_paths: [], total: 0 });
    };
    const { deleteScanImages } = await import("@/lib/curatorApi");

    const outcome = await deleteScanImages("s1", [flagged("a"), flagged("b"), flagged("c")]);
    expect(sentPaths(bodies)).toEqual([["a"], ["b"], ["c"]]);
    expect(outcome).toEqual({ deleted: ["a", "c"], refused: ["b"], error: null });
  });

  it("reports what went before a failure and stops", async () => {
    routes["GET /health"] = () => curator({ delete_any: true });
    let replies = 0;
    routes["POST /scan/s1/delete"] = () =>
      ++replies === 1 ? json({ rel_paths: [], total: 0 }) : json({ detail: "could not delete: disk" }, 400);
    const { deleteScanImages } = await import("@/lib/curatorApi");

    const rows = Array.from({ length: 401 }, (_, i) => plain(`${i}.jpg`));
    const outcome = await deleteScanImages("s1", rows);
    expect(outcome.deleted).toHaveLength(200);
    expect(outcome.error?.message).toContain("could not delete");
    expect(replies).toBe(2);
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

describe("lens writes", () => {
  it("refuses folder captioning when lens has no source root", async () => {
    routes["GET /health"] = () => json({ status: "ok", service: "argus-lens", version: "0.10.0", source_root: null });
    routes["POST /caption/folder"] = sent;
    const { captionFolder } = await import("@/lib/lensApi");
    const { CapabilityRefused } = await import("@/lib/capabilities");

    const err = await captionFolder({ folder: "x" }).catch((e) => e);
    expect(err).toBeInstanceOf(CapabilityRefused);
    expect(calls).toEqual(["GET /health"]);
  });

  it("sends once a source root is advertised, reusing the page's health", async () => {
    routes["GET /health"] = () => json({ status: "ok", service: "argus-lens", version: "0.10.0", source_root: "/data/images" });
    routes["POST /immich/pull"] = sent;
    const { getLensHealth, immichPullStream } = await import("@/lib/lensApi");

    await getLensHealth();
    await expect(immichPullStream({ album_id: "a", dest_folder: "d" }, () => {})).rejects.toThrow("reached the server");
    expect(calls).toEqual(["GET /health", "POST /immich/pull"]);
  });

  it("treats a lens predating source_root as configured", async () => {
    routes["GET /health"] = () => json({ status: "ok", service: "argus-lens", version: "0.5.0" });
    routes["POST /caption/folder"] = sent;
    const { captionFolder } = await import("@/lib/lensApi");

    await expect(captionFolder({ folder: "x" })).rejects.toThrow("reached the server");
  });
});
