import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { allowsDarkroomWrite } from "@/lib/darkroomApi";

import { hasImage } from "./outcome";
import { sampleImageUrl, sampleRecord, sampleRecords, SAMPLE_HEALTH } from "./sample";

describe("the darkroom sample", () => {
  it("refuses every write", () => {
    expect(allowsDarkroomWrite(SAMPLE_HEALTH)).toBe(false);
  });

  it("ships an image for every record that has one, and none for the rest", () => {
    const { records } = sampleRecords({ pageSize: 200 });
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      const file = join(__dirname, "..", "..", "..", "public", sampleImageUrl(record.id));
      expect(existsSync(file)).toBe(hasImage(record));
    }
  });

  it("filters and pages like GET /records", () => {
    const deleted = sampleRecords({ outcome: "deleted", pageSize: 200 });
    expect(deleted.total).toBeGreaterThan(0);
    expect(deleted.records.every((record) => record.outcome === "deleted")).toBe(true);
    expect(sampleRecords({ pageSize: 1, page: 2 }).records).toHaveLength(1);
  });

  it("says when a record doesn't exist", () => {
    expect(() => sampleRecord("nope")).toThrow("No record nope.");
  });
});
