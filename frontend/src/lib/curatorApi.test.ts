import { describe, expect, it } from "vitest";

import type { ExportResult } from "@/components/curator/types";
import {
  allowsExport,
  allowsMove,
  exportedAbsPath,
  exportedRelPath,
  manifestMajor,
  normalizeExportResult,
  speaksSupportedManifest,
  SUPPORTED_MANIFEST_MAJOR,
  type Health,
} from "@/lib/curatorApi";

function result(overrides: Partial<ExportResult> = {}): ExportResult {
  return {
    manifest_path: "/out/manifest.jsonl",
    copied: 2,
    skipped: 0,
    dest: "/out/",
    mode: "copy",
    captioned: false,
    ...overrides,
  };
}

const health = (overrides: Partial<Health> = {}): Health => ({
  status: "ok",
  service: "argus-curator",
  version: "0.3.0",
  ...overrides,
});

describe("manifestMajor", () => {
  it.each([
    ["2.1", 2],
    ["2", 2],
    ["10.0", 10],
    ["0.9", 0],
  ])("reads %j as %j", (version, major) => {
    expect(manifestMajor(version)).toBe(major);
  });

  // Same rule as argus-forge's string comparison: anything forge would refuse
  // must not read as a supported major here.
  it.each(["02.1", "2beta", " 2.1", "", "v2", "2 .1"])("refuses %j", (version) => {
    expect(manifestMajor(version)).toBeNull();
  });

  it.each([2.1, null, undefined, {}])("treats non-string %j as undeclared", (version) => {
    expect(manifestMajor(version)).toBeNull();
  });

  it("derives the supported major from the stamped version", () => {
    expect(SUPPORTED_MANIFEST_MAJOR).toBe(2);
  });
});

describe("normalizeExportResult", () => {
  it("passes a 2.1 result through untouched", () => {
    const n = normalizeExportResult(
      result({
        manifest_version: "2.1",
        exported_paths: { "a/x.jpg": "a/x.jpg" },
        exported_abs_paths: { "a/x.jpg": "/out/a/x.jpg" },
      }),
    );
    expect(n.manifestGap).toBeNull();
    expect(n.exported_paths).toEqual({ "a/x.jpg": "a/x.jpg" });
    expect(n.exported_abs_paths).toEqual({ "a/x.jpg": "/out/a/x.jpg" });
  });

  it("accepts an undeclared 2.0 result by the presence of exported_paths", () => {
    const n = normalizeExportResult(result({ exported_paths: { "x.jpg": "x.jpg" } }));
    expect(n.manifestGap).toBeNull();
    expect(n.exported_abs_paths).toEqual({});
  });

  it("keeps an empty 2.0 map empty — presence, not emptiness, marks 2.x", () => {
    const n = normalizeExportResult(result({ copied: 0, exported_paths: {} }));
    expect(n.manifestGap).toBeNull();
    expect(n.exported_paths).toEqual({});
  });

  it("refuses a pre-2.0 result instead of reconstructing locators", () => {
    const n = normalizeExportResult(result({ selected_rel_paths: ["x.jpg"] }));
    expect(n.manifestGap).toMatch(/predates manifest 2\.0/);
    expect(n.exported_paths).toEqual({});
    expect(n.exported_abs_paths).toEqual({});
  });

  it("refuses an unsupported major even when it carries paths", () => {
    const n = normalizeExportResult(
      result({ manifest_version: "3.0", exported_paths: { "x.jpg": "x.jpg" } }),
    );
    expect(n.manifestGap).toMatch(/manifest 3\.0/);
    expect(n.exported_paths).toEqual({});
  });
});

describe("exported locators", () => {
  const n = normalizeExportResult(
    result({
      manifest_version: "2.1",
      dest: "/out/",
      exported_paths: { "a.jpg": "a.jpg", "b.jpg": "sub/b-1f2e.jpg", "empty.jpg": "" },
      exported_abs_paths: { "a.jpg": "/elsewhere/a.jpg", "empty.jpg": "" },
    }),
  );

  it("prefers the server's absolute path", () => {
    expect(exportedAbsPath(n, "a.jpg")).toBe("/elsewhere/a.jpg");
  });

  it("falls back to joining dest onto the rel locator (2.0 servers)", () => {
    expect(exportedAbsPath(n, "b.jpg")).toBe("/out/sub/b-1f2e.jpg");
  });

  it("reports an untransferred file as null", () => {
    expect(exportedAbsPath(n, "missing.jpg")).toBeNull();
    expect(exportedRelPath(n, "missing.jpg")).toBeNull();
  });

  it("treats empty-string locators as absent, never as the export dir", () => {
    expect(exportedRelPath(n, "empty.jpg")).toBeNull();
    expect(exportedAbsPath(n, "empty.jpg")).toBeNull();
  });
});

describe("curator capabilities", () => {
  it("is unknown while /health is loading or failed", () => {
    expect(allowsMove(null)).toBeNull();
    expect(allowsExport(null)).toBeNull();
    expect(speaksSupportedManifest(null)).toBeNull();
  });

  it("reads allow_move, with legacy servers permissive", () => {
    expect(allowsMove(health({ allow_move: false }))).toBe(false);
    expect(allowsMove(health({ allow_move: true }))).toBe(true);
    expect(allowsMove(health())).toBe(true);
  });

  it("refuses export only on an explicitly null export_root", () => {
    expect(allowsExport(health({ export_root: null }))).toBe(false);
    expect(allowsExport(health({ export_root: "/data/out" }))).toBe(true);
    expect(allowsExport(health())).toBe(true);
  });

  it("checks the advertised manifest major before a destructive export", () => {
    expect(speaksSupportedManifest(health({ manifest_version: "2.1" }))).toBe(true);
    expect(speaksSupportedManifest(health({ manifest_version: "3.0" }))).toBe(false);
    expect(speaksSupportedManifest(health())).toBe(true);
    expect(speaksSupportedManifest(health({ manifest_version: "garbage" }))).toBe(true);
  });
});
