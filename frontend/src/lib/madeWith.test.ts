import { describe, expect, it } from "vitest";

import {
  MADE_WITH_PACKAGES,
  curatorScanCommand,
  darkroomGenerateCommand,
  forgeConfigCommand,
  lensCaptionCommand,
  packageLinks,
  shownVersion,
} from "@/lib/madeWith";

describe("packageLinks", () => {
  it("points every package at its handbook page, PyPI project and repo", () => {
    for (const pkg of MADE_WITH_PACKAGES) {
      const l = packageLinks(pkg);
      expect(l.name).toBe(`argus-${pkg}`);
      expect(l.docs).toBe(`https://docs.dragonhound.dev/packages/${pkg}/`);
      expect(l.pypi).toBe(`https://pypi.org/project/argus-${pkg}/`);
      expect(l.github).toBe(`https://github.com/smk762/argus-${pkg}`);
    }
  });
});

describe("shownVersion", () => {
  it.each([
    ["0.11.0", "0.11.0"],
    ["v0.4.0", "0.4.0"],
    ["0.15.2.dev2+g97021d6", "0.15.2.dev2+g97021d6"],
    [null, null],
    ["", null],
    ["demo", null],
    ["sample", null],
    ["recorded", null],
  ])("%j -> %j", (raw, shown) => {
    expect(shownVersion(raw)).toBe(shown);
  });
});

describe("commands", () => {
  it("names only the non-default lens settings", () => {
    expect(lensCaptionCommand({ backend: "hybrid" })).toBe("argus-lens caption <images> --backend hybrid");
    expect(lensCaptionCommand({ backend: "florence2", style: "anime", category: "wardrobe", targetBackend: "flux" })).toBe(
      "argus-lens caption <images> --backend florence2 --style anime --category wardrobe --target-backend flux",
    );
  });

  it("builds the curator, forge and darkroom commands from what the page shows", () => {
    expect(curatorScanCommand("identity")).toBe("argus-curator scan <folder>");
    expect(curatorScanCommand("setting")).toBe("argus-curator scan <folder> --target-category setting");
    expect(forgeConfigCommand("onetrainer")).toBe("argus-forge config <export> --trainer onetrainer");
    expect(forgeConfigCommand(null)).toBe("argus-forge config <export> --trainer kohya");
    expect(darkroomGenerateCommand("default")).toBe("argus-darkroom generate --policy default");
    expect(darkroomGenerateCommand(null)).toBe("argus-darkroom generate");
  });
});
