import { afterEach, describe, expect, it, vi } from "vitest";

import { getRecords } from "@/lib/darkroomApi";

// Audit pack-argus-studio-2ea942fea1: filters must reach the URL even where
// URLSearchParams.size doesn't exist (older browsers and jsdom).
describe("getRecords query string", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends every filter, built from the serialised params", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ records: [], total: 0, page: 2, page_size: 5 }), { status: 200 });
    });
    const sizeDesc = Object.getOwnPropertyDescriptor(URLSearchParams.prototype, "size");
    Object.defineProperty(URLSearchParams.prototype, "size", { configurable: true, get: () => undefined });
    try {
      await getRecords({ outcome: "passed", mode: "sfw", page: 2, pageSize: 5 });
    } finally {
      if (sizeDesc) Object.defineProperty(URLSearchParams.prototype, "size", sizeDesc);
    }
    expect(urls[0]).toMatch(/\/records\?outcome=passed&mode=sfw&page=2&page_size=5$/);
  });
});
