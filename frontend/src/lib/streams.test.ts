import { describe, expect, it } from "vitest";

import { asError } from "@/lib/apiError";
import { readNdjson } from "@/lib/lensApi";
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
