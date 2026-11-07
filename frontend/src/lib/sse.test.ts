import { describe, expect, it } from "vitest";

import { parseSseFrames, readSseFrames, type SseFrame } from "@/lib/sse";

function stream(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(typeof c === "string" ? enc.encode(c) : c);
      controller.close();
    },
  });
}

async function collect(chunks: (string | Uint8Array)[]): Promise<SseFrame[]> {
  const seen: SseFrame[] = [];
  await readSseFrames(stream(chunks), (frame) => seen.push(frame));
  return seen;
}

describe("parseSseFrames", () => {
  it("keeps a trailing partial frame for the next read", () => {
    const { events, rest } = parseSseFrames('event: a\ndata: {"n":1}\n\nevent: b\ndata: {"n"');
    expect(events).toEqual([{ event: "a", data: { n: 1 } }]);
    expect(rest).toBe('event: b\ndata: {"n"');
  });

  it("defaults the event name and joins multi-line data", () => {
    expect(parseSseFrames('data: {"a":\ndata: 1}\n\n').events).toEqual([{ event: "message", data: { a: 1 } }]);
  });

  it("skips comments and frames with empty data", () => {
    expect(parseSseFrames(": keepalive\n\nevent: ping\ndata:\n\n").events).toEqual([]);
  });
});

describe("readSseFrames", () => {
  it("reassembles a frame split across chunks", async () => {
    expect(await collect(["event: pro", 'gress\ndata: {"done"', ":1}\n\n"])).toEqual([{ event: "progress", data: { done: 1 } }]);
  });

  it("decodes a multi-byte character split across chunks", async () => {
    const bytes = new TextEncoder().encode('data: {"caption":"café"}\n\n');
    const cut = bytes.length - 6; // inside the two-byte é
    expect(await collect([bytes.slice(0, cut), bytes.slice(cut)])).toEqual([{ event: "message", data: { caption: "café" } }]);
  });

  it("delivers a last frame with no closing blank line", async () => {
    expect(await collect(['event: complete\ndata: {"id":"s1"}'])).toEqual([{ event: "complete", data: { id: "s1" } }]);
  });

  it("drops a last frame cut off mid-JSON", async () => {
    expect(await collect(['event: a\ndata: {"n":1}\n\nevent: complete\ndata: {"id"'])).toEqual([{ event: "a", data: { n: 1 } }]);
  });

  it("releases the stream when a handler throws", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: error\ndata: {"detail":"no"}\n\n'));
      },
      cancel() {
        cancelled = true;
      },
    });
    await expect(
      readSseFrames(body, () => {
        throw new Error("stop");
      }),
    ).rejects.toThrow("stop");
    expect(cancelled).toBe(true);
    expect(body.locked).toBe(false);
  });
});
