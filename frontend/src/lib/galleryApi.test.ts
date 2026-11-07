import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  externalUrl,
  getArchiveItem,
  getQuarryPhoto,
  getQuarryReadiness,
  parsePhotoId,
} from "@/lib/galleryApi";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let respond: () => Response | Promise<Response>;
let urls: string[];

beforeEach(() => {
  urls = [];
  vi.stubGlobal("fetch", async (url: string) => {
    urls.push(new URL(url).pathname);
    return respond();
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("getQuarryReadiness", () => {
  it("is ready on a 200", async () => {
    respond = () => json({ status: "ready", service: "argus-quarry", database: "ok" });
    await expect(getQuarryReadiness()).resolves.toBe("ready");
    expect(urls).toEqual(["/ready"]);
  });

  it("is not ready on quarry's own 503", async () => {
    respond = () =>
      json({ status: "unavailable", service: "argus-quarry", database: "provenance database unavailable" }, 503);
    await expect(getQuarryReadiness()).resolves.toBe("not_ready");
  });

  it("doesn't take a proxy's 503 for quarry's", async () => {
    respond = () => new Response("<html>Service Unavailable</html>", { status: 503 });
    await expect(getQuarryReadiness()).resolves.toBe("unknown");
  });

  it("is unknown on a quarry older than /ready", async () => {
    respond = () => json({ detail: "Not Found" }, 404);
    await expect(getQuarryReadiness()).resolves.toBe("unknown");
  });

  it("is unknown on a server error", async () => {
    respond = () => json({ detail: "boom" }, 500);
    await expect(getQuarryReadiness()).resolves.toBe("unknown");
  });
});

describe("detail fetchers", () => {
  it("reads a photo by id", async () => {
    respond = () => json({ id: 7, status: "quarantined" });
    await expect(getQuarryPhoto(7)).resolves.toMatchObject({ id: 7, status: "quarantined" });
    expect(urls).toEqual(["/photos/7"]);
  });

  it("surfaces quarry's detail for an unknown photo", async () => {
    respond = () => json({ detail: "unknown photo id: 7" }, 404);
    await expect(getQuarryPhoto(7)).rejects.toThrow("unknown photo id: 7");
  });

  it("reads an archive item, escaping the path", async () => {
    respond = () => json({ id: "a/b" });
    await getArchiveItem("pd12m", "a/b");
    expect(urls).toEqual(["/archives/pd12m/items/a%2Fb"]);
  });

  it("surfaces quarry's detail for an unbuilt index", async () => {
    respond = () => json({ detail: "pd12m: no index yet" }, 503);
    await expect(getArchiveItem("pd12m", "x")).rejects.toThrow("pd12m: no index yet");
  });
});

describe("parsePhotoId", () => {
  it("accepts a positive integer", () => {
    expect(parsePhotoId("42")).toBe(42);
  });

  it.each([null, "", "0", "-1", "1.5", "1e3", " 1", "abc", "007", "99999999999999999999"])("refuses %j", (raw) => {
    expect(parsePhotoId(raw)).toBeNull();
  });
});

describe("externalUrl", () => {
  it("passes http and https through unchanged", () => {
    expect(externalUrl("https://commons.wikimedia.org/wiki/File:A.jpg")).toBe("https://commons.wikimedia.org/wiki/File:A.jpg");
    expect(externalUrl("http://example.org/a")).toBe("http://example.org/a");
  });

  it.each([null, undefined, "", "not a url", "/relative", "javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,x", "s3://pd12m/a"])(
    "refuses %j",
    (raw) => {
      expect(externalUrl(raw)).toBeNull();
    },
  );
});
