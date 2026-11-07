import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The seams with argus-atlas 0.3.0a1 that aren't capability gates (those are in
// writeGates.test.ts): the bake stream's frames and what a 409 from /tiles means.

type Route = (init?: RequestInit) => Response;
let routes: Record<string, Route>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const ndjson = (...frames: object[]) => new Response(frames.map((f) => JSON.stringify(f)).join("\n") + "\n");
const frame = (type: string, message = type) => ({ job_id: "j", type, message });

beforeEach(() => {
  vi.resetModules();
  routes = {
    "GET /health": () =>
      json({ status: "ok", service: "argus-atlas", version: "0.3.0a1", read_only: false, gdal: "GDAL 3.11.4" }),
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const route = routes[`${init?.method ?? "GET"} ${new URL(url).pathname}`];
    if (!route) throw new TypeError("Failed to fetch");
    return route(init);
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("bakeStream", () => {
  it("passes tiles frames on and still resolves when they follow done", async () => {
    routes["POST /bake/stream"] = () => ndjson(frame("generate"), frame("done"), frame("tiles", "cut 21 tiles"));
    const { bakeStream } = await import("@/lib/atlasApi");
    const seen: string[] = [];

    await bakeStream({ job_id: "j", checkpoint: "c" }, (p) => seen.push(p.type));
    expect(seen).toEqual(["generate", "done", "tiles"]);
  });

  it("rejects when tiling fails after the bake's done", async () => {
    routes["POST /bake/stream"] = () => ndjson(frame("done"), frame("tiles"), frame("error", "tiler gave up"));
    const { bakeStream } = await import("@/lib/atlasApi");

    await expect(bakeStream({ job_id: "j", checkpoint: "c" }, () => {})).rejects.toThrow("tiler gave up");
  });
});

describe("cutTiles", () => {
  const detail = "chunk 11/1/2 of j was never cropped — bake it again";

  it("turns a 409 into NotTileableError with the server's reason", async () => {
    routes["POST /tiles"] = () => json({ detail }, 409);
    const { cutTiles, NotTileableError } = await import("@/lib/atlasApi");

    const err = await cutTiles("j").catch((e) => e);
    expect(err).toBeInstanceOf(NotTileableError);
    expect(err.message).toBe(detail);
  });

  it("leaves any other failure an ordinary error", async () => {
    routes["POST /tiles"] = () => json({ detail: "gdal2tiles.py is not on PATH" }, 503);
    const { cutTiles, NotTileableError } = await import("@/lib/atlasApi");

    const err = await cutTiles("j").catch((e) => e);
    expect(err).not.toBeInstanceOf(NotTileableError);
    expect(err.message).toContain("gdal2tiles");
  });
});

describe("reads", () => {
  it("surfaces the labels 404's advice", async () => {
    routes["GET /jobs/j/labels"] = () => json({ detail: "job 'j' has no labels (run `argus-atlas labels --job`)" }, 404);
    const { getLabels } = await import("@/lib/atlasApi");

    await expect(getLabels("j")).rejects.toThrow(/argus-atlas labels/);
  });
});
