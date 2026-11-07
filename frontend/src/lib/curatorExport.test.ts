import { describe, expect, it } from "vitest";

import type { ExportResult, ImageResult, ScanSummary } from "@/components/curator/types";
import { buildRunStats, exportNotes, faceNamesBody, faceNamesProblem, scanHasCrops } from "@/lib/curatorExport";

const box = { left: 0, top: 0, right: 10, bottom: 10 };
const row = (crop: ImageResult["crop"] = null) => ({ rel_path: "a", crop }) as ImageResult;
const result = (extra: Partial<ExportResult>) => ({ copied: 1, ...extra }) as ExportResult;

describe("face names", () => {
  it("trims, and leaves blanks out because the curator refuses them", () => {
    expect(faceNamesBody({ face_1: "  Ada ", face_2: "   " })).toEqual({ face_1: "Ada" });
  });

  it("sends nothing when no name is left", () => {
    expect(faceNamesBody({ face_1: "" })).toBeNull();
    expect(faceNamesBody({})).toBeNull();
  });

  it("flags a name the curator would refuse", () => {
    expect(faceNamesProblem({ face_1: "x".repeat(200) })).toBeNull();
    expect(faceNamesProblem({ face_1: "x".repeat(201) })).toMatch(/face_1/);
  });
});

describe("scanHasCrops", () => {
  it("reads every row, as the curator's request check does", () => {
    expect(scanHasCrops([row(), row(box)])).toBe(true);
    expect(scanHasCrops([row(), { rel_path: "b" } as ImageResult])).toBe(false);
  });
});

describe("exportNotes", () => {
  it("says nothing an older curator did not report", () => {
    expect(exportNotes(result({}))).toEqual({ notes: [], warning: null });
  });

  it("reports what the export wrote", () => {
    expect(exportNotes(result({ cropped: 1, xmp_written: 2, sidecars_carried: 3 })).notes).toEqual([
      "1 image written cropped.",
      "2 XMP sidecars written.",
      "3 sidecars carried.",
    ]);
  });

  it("keeps a failed sidecar apart as a warning", () => {
    expect(exportNotes(result({ sidecars_failed: 1 })).warning).toMatch(/1 sidecar could not be carried/);
  });
});

describe("buildRunStats", () => {
  const summary = {
    scan_id: "s",
    folder: "/data/images",
    target_profile: { target_category: "identity" },
    total: 3,
    passed: 2,
    rejected: 1,
    duplicates: 0,
    reject_reasons: { blurry: 1 },
    faces_config: { enabled: true },
    nsfw_config: { enabled: null },
    crop_config: { enabled: true, detect: true },
  } as unknown as ScanSummary;

  it("counts the export and records how the scan ran", () => {
    const stats = buildRunStats(summary, [row(box), row()], "0.14.1", new Date("2026-11-07T00:00:00Z"));
    expect(stats).toMatchObject({
      generated_at: "2026-11-07T00:00:00.000Z",
      curator_version: "0.14.1",
      images: { total: 3, exporting: 2, cropped: 1 },
      config: { nsfw: false, crops: true, watermark_detect: true },
    });
  });

  it("names no file", () => {
    expect(JSON.stringify(buildRunStats(summary, [row()], null))).not.toContain('"a"');
  });
});
