import { describe, expect, it } from "vitest";

import { DELETE_BATCH_SIZE, deleteBatches, deleteConfirmText, deleteReport } from "@/lib/scanDelete";

describe("deleteBatches", () => {
  it("keeps every request within the server's limit, in order", () => {
    const paths = Array.from({ length: DELETE_BATCH_SIZE * 2 + 1 }, (_, i) => `${i}.jpg`);
    const batches = deleteBatches(paths);
    expect(batches.map((batch) => batch.length)).toEqual([DELETE_BATCH_SIZE, DELETE_BATCH_SIZE, 1]);
    expect(batches.flat()).toEqual(paths);
  });

  it("sends nothing for no paths", () => {
    expect(deleteBatches([])).toEqual([]);
  });
});

describe("deleteConfirmText", () => {
  it("says the files go for good", () => {
    expect(deleteConfirmText(1)).toBe(
      "Permanently delete 1 image from disk? The source files are removed and this cannot be undone.",
    );
  });

  it("names frames the filters are hiding", () => {
    expect(deleteConfirmText(3, 1)).toContain("3 images");
    expect(deleteConfirmText(3, 1)).toContain("1 of them is hidden");
    expect(deleteConfirmText(3, 2)).toContain("2 of them are hidden");
  });
});

describe("deleteReport", () => {
  it("is a notice when everything went", () => {
    expect(deleteReport(2, { deleted: ["a", "b"], refused: [], error: null })).toEqual({
      text: "Deleted 2 images from disk.",
      failed: false,
    });
  });

  it("says how far a failed delete got", () => {
    const report = deleteReport(3, { deleted: ["a"], refused: [], error: new Error("disk full") });
    expect(report).toEqual({ text: "Stopped after deleting 1 of 3: disk full", failed: true });
  });

  it("counts frames the server refused as kept", () => {
    const report = deleteReport(3, { deleted: ["a", "b"], refused: ["c"], error: null });
    expect(report.failed).toBe(true);
    expect(report.text).toContain("Deleted 2 of 3");
    expect(report.text).toContain("kept 1");
  });
});
