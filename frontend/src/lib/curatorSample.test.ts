import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sampleThumb } from "./curatorSample";

const publicDir = fileURLToPath(new URL("../../public", import.meta.url));
const scan = JSON.parse(readFileSync(`${publicDir}/curator-sample/scan.json`, "utf8")) as {
  total: number;
  results: { rel_path: string }[];
};

describe("sampleThumb", () => {
  it("maps a scanned path to its bundled WebP and size", () => {
    expect(sampleThumb("personA/studio/01.jpg")).toEqual({
      src: "/curator-sample/thumbs/personA/studio/01.webp",
      width: 263,
      height: 384,
    });
  });

  it("returns null for a path outside the sample", () => {
    expect(sampleThumb("elsewhere/x.jpg")).toBeNull();
    expect(sampleThumb("constructor")).toBeNull();
  });

  it("has a bundled thumbnail for every image in the recorded scan", () => {
    expect(scan.results).toHaveLength(scan.total);
    for (const row of scan.results) {
      const thumb = sampleThumb(row.rel_path);
      expect(thumb, row.rel_path).not.toBeNull();
      expect(existsSync(`${publicDir}${decodeURIComponent(thumb!.src)}`), row.rel_path).toBe(true);
    }
  });
});
