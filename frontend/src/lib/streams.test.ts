import { describe, expect, it, vi } from "vitest";

import { ApiError, asError, readError } from "@/lib/apiError";
import { CapabilityRefused } from "@/lib/capabilities";
import { LENS_CATEGORY } from "@/components/curator/types";
import { isDeterminatePhase, readSseStream, scanPhaseLabel, StreamCancelled } from "@/lib/curatorApi";
import { categoryOptions, readNdjson } from "@/lib/lensApi";
import { TARGET_CATEGORIES } from "@/types";
import { basename, joinPath } from "@/lib/path";

/** A Response whose body arrives in exactly these chunks, to exercise line buffering. */
function chunked(chunks: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(body);
}

describe("readNdjson", () => {
  it("reassembles lines split across chunks and skips blank lines", async () => {
    const seen: unknown[] = [];
    await readNdjson(chunked(['{"type":"start"}\n{"type":"it', 'em","n":1}\n\n', '{"type":"done"}']), (o) => seen.push(o));
    expect(seen).toEqual([{ type: "start" }, { type: "item", n: 1 }, { type: "done" }]);
  });

  it("decodes a multi-byte character split across chunks", async () => {
    const bytes = new TextEncoder().encode('{"caption":"café"}\n');
    const cut = bytes.length - 4; // inside the two-byte é
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, cut));
        c.enqueue(bytes.slice(cut));
        c.close();
      },
    });
    const seen: unknown[] = [];
    await readNdjson(new Response(body), (o) => seen.push(o));
    expect(seen).toEqual([{ caption: "café" }]);
  });

  it("refuses a response with no body", async () => {
    await expect(readNdjson(new Response(null), () => {})).rejects.toThrow(/no body/);
  });
});

describe("asError", () => {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("surfaces a FastAPI string detail", async () => {
    await expect(asError(json(403, { detail: "fetch disabled" }))).rejects.toThrow("fetch disabled");
  });

  it("formats a 422 validation list instead of [object Object]", async () => {
    const r = json(422, { detail: [{ loc: ["body", "limit"], msg: "must be <= 200" }, { loc: ["query"], msg: "bad" }] });
    await expect(asError(r)).rejects.toThrow("Invalid request — limit: must be <= 200; query: bad");
  });

  it("falls back to the status when the body is not JSON", async () => {
    await expect(asError(new Response("<html>", { status: 502 }))).rejects.toThrow("Server error: 502");
  });

  it("throws an ApiError carrying the status, which error spans read as any Error", async () => {
    const err: unknown = await asError(json(503, { detail: "detector down" })).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
    expect(err).toMatchObject({ message: "detector down", status: 503 });
  });

  it("reads the detail without throwing", async () => {
    await expect(readError(json(409, { detail: "busy" }))).resolves.toBe("busy");
  });

  it("leaves CapabilityRefused a plain Error, not an ApiError", () => {
    const refused = new CapabilityRefused("read-only", true);
    expect(refused).toBeInstanceOf(Error);
    expect(refused).not.toBeInstanceOf(ApiError);
  });
});

describe("path helpers", () => {
  it("joins with exactly one separator", () => {
    expect(joinPath("/data/out/", "/a/b.jpg/")).toBe("/data/out/a/b.jpg");
    expect(joinPath("/data/out", "b.jpg")).toBe("/data/out/b.jpg");
  });

  it("takes the last segment, never an empty string", () => {
    expect(basename("/data/out/b.jpg")).toBe("b.jpg");
    expect(basename("/data/out/")).toBe("out");
    expect(basename("b.jpg")).toBe("b.jpg");
  });
});

describe("lens upload stream", () => {
  it("separates per-image error lines from captions", async () => {
    const { captionFilesStream } = await import("@/lib/lensApi");
    const body = '{"name":"a.jpg","final_caption":"x","caption_variants":{}}\n{"name":"b.jpg","error":"replay miss"}\n';
    const seen: number[] = [];
    vi.stubGlobal("fetch", async () => new Response(body));
    try {
      const out = await captionFilesStream([], {}, (_r, done) => seen.push(done));
      expect(out.rows.map((r) => r.name)).toEqual(["a.jpg"]);
      expect(out.errors).toEqual([{ name: "b.jpg", error: "replay miss" }]);
      expect(seen).toEqual([1, 2]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("lens category options", () => {
  it("prefers lens's own list, keeping known labels and title-casing new ones", () => {
    const known = [{ value: "pose_composition", label: "Pose / Composition" }];
    expect(categoryOptions(["pose_composition", "body_type"], known)).toEqual([
      { value: "pose_composition", label: "Pose / Composition" },
      { value: "body_type", label: "Body Type" },
    ]);
  });

  it("falls back to the static list when /profiles has none", () => {
    expect(categoryOptions(undefined, TARGET_CATEGORIES)).toHaveLength(TARGET_CATEGORIES.length);
    expect(categoryOptions([], TARGET_CATEGORIES).map((c) => c.value)).not.toContain("pose_gaze");
  });

  it("offers only categories lens 0.10 defines", () => {
    const lens010 = ["identity", "wardrobe", "pose_composition", "setting", "lighting", "action"];
    expect(TARGET_CATEGORIES.map((c) => c.value)).toEqual(lens010);
    expect(Object.values(LENS_CATEGORY).every((v) => lens010.includes(v))).toBe(true);
  });
});

describe("curator readSseStream", () => {
  const sse = (frames: string[]) => chunked(frames).body!;

  it("dispatches progress, ignores chunk frames nobody asked for, resolves with complete", async () => {
    const seen: unknown[] = [];
    const out = await readSseStream<unknown, { scan_id: string }>(
      sse([
        'event: progress\ndata: {"phase":"nsfw","done":1,"total":4}\n\n',
        'event: chunk\ndata: {"results":[]}\n\nevent: comp',
        'lete\ndata: {"scan_id":"s1"}\n\n',
      ]),
      (p) => seen.push(p),
      "Scan",
    );
    expect(seen).toEqual([{ phase: "nsfw", done: 1, total: 4 }]);
    expect(out).toEqual({ scan_id: "s1" });
  });

  it("forwards chunk frames when a scan is listening", async () => {
    const chunks: unknown[] = [];
    await readSseStream(
      sse(['event: chunk\ndata: {"scan_id":"s1","results":[{"rel_path":"a.jpg"}]}\n\n', 'event: complete\ndata: {"scan_id":"s1"}\n\n']),
      () => {},
      "Scan",
      (chunk) => chunks.push(chunk),
    );
    expect(chunks).toEqual([{ scan_id: "s1", results: [{ rel_path: "a.jpg" }] }]);
  });

  it("throws StreamCancelled on event: cancelled", async () => {
    const run = readSseStream(sse(['event: cancelled\ndata: {"scan_id":"s1"}\n\n']), () => {}, "Scan");
    await expect(run).rejects.toBeInstanceOf(StreamCancelled);
    await expect(
      readSseStream(sse(['event: cancelled\ndata: {"scan_id":"s1"}\n\n']), () => {}, "Scan"),
    ).rejects.toThrow(/Scan was stopped/);
  });

  it("appends retry_after to a GPU-busy error", async () => {
    const run = readSseStream(
      sse(['event: error\ndata: {"detail":"GPU busy: lease timed out","retry_after":5}\n\n']),
      () => {},
      "Scan",
    );
    await expect(run).rejects.toThrow("GPU busy: lease timed out (retry in 5s)");
  });

  it("resolves with a complete frame missing its closing blank line", async () => {
    await expect(readSseStream(sse(['event: complete\ndata: {"scan_id":"s1"}']), () => {}, "Scan")).resolves.toEqual({ scan_id: "s1" });
  });

  it("says the stream ended when the complete frame was cut off", async () => {
    await expect(readSseStream(sse(['event: complete\ndata: {"scan_i']), () => {}, "Scan")).rejects.toThrow("Scan stream ended without a result");
  });

  it("still fails when the stream ends without a result", async () => {
    await expect(readSseStream(sse(['event: progress\ndata: {"phase":"scoring","done":0,"total":1}\n\n']), () => {}, "Export")).rejects.toThrow(
      "Export stream ended without a result",
    );
  });
});

describe("scan phases", () => {
  it("labels every phase curator 0.13 emits", () => {
    for (const p of ["collecting", "scoring", "watermarks", "faces", "erax", "nsfw", "identities", "prefilter", "scenes", "garments", "guard", "clustering"]) {
      expect(scanPhaseLabel(p)).not.toBe("");
    }
    expect(scanPhaseLabel("guard")).toBe("Running SingGuard");
    expect(scanPhaseLabel("watermarks")).toBe("Finding watermarks");
    expect(isDeterminatePhase("watermarks")).toBe(true);
  });

  it("falls back to a readable label for an unknown phase", () => {
    expect(scanPhaseLabel("crop_boxes")).toBe("Crop boxes");
    expect(scanPhaseLabel("")).toBe("Working");
    expect(scanPhaseLabel("toString")).toBe("ToString");
  });

  it("only gives running-count phases a determinate bar", () => {
    expect(isDeterminatePhase("nsfw")).toBe(true);
    expect(isDeterminatePhase("crop_boxes")).toBe(true);
    expect(isDeterminatePhase("collecting")).toBe(false);
    expect(isDeterminatePhase("identities")).toBe(false);
  });
});
