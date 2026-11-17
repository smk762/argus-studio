import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { fixtureRecords } from "@/lib/darkroom/fixture.test-util";
import { recordMarks } from "@/lib/darkroom/outcome";
import type { GenerationRecord } from "@/lib/darkroomApi";

import { ComposeProvider } from "./ComposeProvider";
import { DarkroomProvider } from "./DarkroomProvider";
import { HistoryRow } from "./History";
import { ImageTile } from "./OutcomeTiles";
import { ResultView } from "./ResultView";

// Darkroom never renders an image for a deleted, omitted, refused or failed
// record, or for one whose image the user removed (argus-studio#263). The
// views are rendered here for every fixture record and the markup is read, so
// this does not lean on hasImage(): a view that skipped it would fail.

const render = (view: ReactElement) =>
  renderToStaticMarkup(createElement(DarkroomProvider, null, createElement(ComposeProvider, null, view)));

const served = (record: GenerationRecord) =>
  (record.outcome === "passed" || record.outcome === "review") && record.removed_at == null;

const fixture = fixtureRecords();
const removed = fixture
  .filter((record) => record.outcome === "passed" || record.outcome === "review")
  .map((record) => ({ ...record, id: `${record.id}-removed`, removed_at: "2026-11-01T00:00:00Z" }));
const records = [...fixture, ...removed];

const VIEWS: [string, (record: GenerationRecord) => ReactElement][] = [
  ["ResultView", (record) => createElement(ResultView, { record })],
  ["HistoryRow", (record) => createElement(HistoryRow, { record })],
  ["ImageTile", (record) => createElement(ImageTile, { record })],
];

describe("darkroom record images", () => {
  it("covers every outcome, and a removed image", () => {
    expect([...new Set(fixture.map((record) => record.outcome))].sort()).toEqual(
      ["deleted", "failed", "omitted", "passed", "refused", "review"],
    );
    expect(removed.length).toBeGreaterThan(0);
  });

  for (const [name, view] of VIEWS) {
    describe(name, () => {
      for (const record of records) {
        it(`${record.id}: ${served(record) ? "shows its image" : "shows no image"}`, () => {
          const html = render(view(record));
          expect(/<img\b/.test(html)).toBe(served(record));
        });
      }
    });
  }

  it("marks each record view with its outcome, for the page check in bombadil/spec.ts", () => {
    for (const record of records) {
      for (const [name, view] of VIEWS.slice(0, 2)) {
        const html = render(view(record));
        expect(html, name).toContain(`data-outcome="${record.outcome}"`);
        expect(html.includes("data-removed"), name).toBe(record.removed_at != null);
      }
    }
    expect(recordMarks({ outcome: "deleted", removed_at: null })).toEqual({ "data-outcome": "deleted" });
  });

  it("an <img> in a darkroom component sits in a file that asks hasImage()", () => {
    const dir = join(process.cwd(), "src/components/darkroom");
    const withImg = readdirSync(dir)
      .filter((f) => f.endsWith(".tsx"))
      .filter((f) => /<img\b/.test(readFileSync(join(dir, f), "utf8")));
    expect(withImg.sort()).toEqual(["History.tsx", "OutcomeTiles.tsx"]);
    for (const f of withImg) expect(readFileSync(join(dir, f), "utf8"), f).toMatch(/\bhasImage\(/);
  });
});
