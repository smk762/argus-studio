/**
 * Server-sent events over `fetch`. Curator and darkroom stream from POST
 * endpoints, which `EventSource` can't call, so both read the body by hand.
 *
 * Only SSE lives here. The NDJSON streams (`readNdjson` in lensApi.ts) have no
 * frames or event names, so they keep their own line reader.
 */

export interface SseFrame {
  event: string;
  data: unknown;
}

/** Split a byte stream into SSE frames, keeping a trailing partial frame. */
export function parseSseFrames(buffer: string): { events: SseFrame[]; rest: string } {
  const events: SseFrame[] = [];
  let rest = buffer;
  while (true) {
    const split = rest.indexOf("\n\n");
    if (split === -1) break;
    const raw = rest.slice(0, split);
    rest = rest.slice(split + 2);
    if (!raw.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
    }
    const data = dataLines.join("\n");
    if (!data.trim()) continue;
    events.push({ event, data: JSON.parse(data) });
  }
  return { events, rest };
}

/** The last frame of a stream with no closing blank line. One cut off mid-JSON is dropped: the caller's "ended without a result" says more than a parse error. */
function parseTail(rest: string): SseFrame[] {
  if (!rest.trim()) return [];
  try {
    return parseSseFrames(`${rest}\n\n`).events;
  } catch {
    return [];
  }
}

/**
 * Read a stream to its end, calling `onFrame` for each frame.
 *
 * `onFrame` may throw to stop early. The `finally` matters then: without it the
 * reader keeps its lock and the response body is never cancelled, so each failed
 * stream leaks a connection, a handful of retries exhaust the browser's per-host
 * pool, and every later request to that service hangs.
 */
export async function readSseFrames(body: ReadableStream<Uint8Array>, onFrame: (frame: SseFrame) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let rest = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      rest += decoder.decode(value, { stream: !done });
      const parsed = parseSseFrames(rest);
      rest = parsed.rest;
      for (const frame of parsed.events) onFrame(frame);
      if (done) break;
    }
    for (const frame of parseTail(rest)) onFrame(frame);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
