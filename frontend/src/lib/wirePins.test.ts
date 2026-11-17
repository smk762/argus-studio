import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { releaseOf, versionFrom } from "../../scripts/release-version.mjs";

// schema/pins.json: each wire schema follows its package's dev HEAD (argus-studio#170).
const pins: Record<
  string,
  { repo: string; branch: string; commit: string; version: string; sha256: string; kind?: "fixture" }
> = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "schema", "pins.json"), "utf8"),
);

describe("wire pins", () => {
  it.each(Object.entries(pins))("%s records a dev commit and the version built from it", (service, pin) => {
    expect(pin.branch).toBe("dev");
    expect(pin.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(pin.sha256).toMatch(/^[0-9a-f]{64}$/);
    // At a tag the version is the release itself; otherwise its local part names the commit.
    const local = pin.version.match(/^\d+\.\d+\.\d+(?:\.dev\d+\+g([0-9a-f]+))?$/);
    expect(local, `${service} version ${pin.version}`).not.toBeNull();
    if (local![1]) expect(pin.commit.startsWith(local![1])).toBe(true);
    if (pin.kind === "fixture") return; // a data file: pulled and sha-checked, no generated types
    const generated = readFileSync(join(__dirname, "generated", `${service}.ts`), "utf8");
    expect(generated.split("\n")[0]).toContain(`${pin.repo}@${pin.commit.slice(0, 7)} (${pin.version})`);
  });
});

describe("releaseOf", () => {
  // dev: a1 <- a2 <- a3 (HEAD). v0.2.0 is a merge on main whose second parent is a2.
  const history = new Set(["a1", "a2", "a3"]);
  const isAncestor = (c: string) => history.has(c);

  it("counts a release tagged on a merge into main by its second parent", () => {
    const tags = [
      { tag: "v0.2.0", commit: "m1", released: ["m1", "a2"] },
      { tag: "v0.1.1", commit: "a1", released: ["a1"] },
    ];
    expect(releaseOf(tags, isAncestor)).toEqual({ tag: "v0.2.0", base: "a2" });
  });

  it("falls back to an older tag in dev's own history", () => {
    const tags = [
      { tag: "v0.3.0", commit: "m9", released: ["m9", "z9"] },
      { tag: "v0.1.1", commit: "a1", released: ["a1"] },
    ];
    expect(releaseOf(tags, isAncestor)).toEqual({ tag: "v0.1.1", base: "a1" });
  });

  it("returns null with no release behind the commit", () => {
    expect(releaseOf([{ tag: "v9.0.0", commit: "x", released: ["x"] }], isAncestor)).toBeNull();
  });
});

describe("versionFrom", () => {
  it("is the tag itself at distance 0, else the next patch's dev release", () => {
    expect(versionFrom("v0.2.0", 0, "abc1234")).toBe("0.2.0");
    expect(versionFrom("v0.2.0", 25, "44e7e6b00")).toBe("0.2.1.dev25+g44e7e6b00");
  });
});
