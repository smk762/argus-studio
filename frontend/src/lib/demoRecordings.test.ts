import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { RECORDED_CAPTION } from "./lensSample";

// schema/demo.json records which package build made each recorded demo sample
// (argus-studio#170): its dev commit and the version at that commit. Each
// recording carries the version it was made with, and must agree with the
// record; a package with a wire pin must also agree with that pin, so the
// demo data and the generated types describe the same build.
interface DemoRecord {
  repo: string;
  branch: string;
  commit: string;
  version: string;
  recorded_at: string;
  recording: string;
}

const FRONTEND = join(__dirname, "..", "..");
const read = (path: string) => JSON.parse(readFileSync(join(FRONTEND, path), "utf8"));
const demo: Record<string, DemoRecord> = read("schema/demo.json");
const pins: Record<string, { version: string; commit: string }> = read("schema/pins.json");

/** The version each recording says it was made with. */
const recordedVersion: Record<string, () => string | undefined> = {
  lens: () => (RECORDED_CAPTION.metadata as Record<string, unknown>).lens_version as string | undefined,
  curator: () => read("public/curator-sample/recording.json").version,
};

describe("demo recordings", () => {
  it("cover every recording Studio ships", () => {
    expect(Object.keys(demo).sort()).toEqual(Object.keys(recordedVersion).sort());
  });

  it.each(Object.entries(demo))("%s: the record names a dev commit and the version built from it", (name, rec) => {
    expect(rec.branch).toBe("dev");
    expect(rec.commit).toMatch(/^[0-9a-f]{40}$/);
    const local = rec.version.match(/^\d+\.\d+\.\d+(?:\.dev\d+\+g([0-9a-f]+))?$/);
    expect(local, `${name} version ${rec.version}`).not.toBeNull();
    if (local![1]) expect(rec.commit.startsWith(local![1])).toBe(true);
    expect(rec.recorded_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(Object.entries(demo))("%s: the recording was made by the recorded build", (name, rec) => {
    expect(recordedVersion[name](), `${rec.recording} vs schema/demo.json`).toBe(rec.version);
  });

  it.each(Object.entries(demo).filter(([name]) => name in pins))(
    "%s: the recording and the wire pin describe the same build",
    (name, rec) => {
      expect(rec.commit, `schema/demo.json vs schema/pins.json for ${name}`).toBe(pins[name].commit);
      expect(rec.version).toBe(pins[name].version);
    },
  );
});
