import { describe, expect, it } from "vitest";

import { CaptionRuns } from "@/lib/captionRun";

type Mode = "url" | "folder" | "immich";

describe("CaptionRuns", () => {
  it("keeps a superseded run off the screen and away from the newer run's state", () => {
    const runs = new CaptionRuns<Mode>();
    let resets = 0;
    const reset = () => {
      resets += 1;
    };
    const folder = runs.begin("folder");
    const immich = runs.begin("immich");

    // The folder request settles while the album is still streaming.
    expect(folder.shows("folder")).toBe(false);
    folder.finish(reset);
    expect(resets).toBe(0);

    expect(immich.shows("immich")).toBe(true);
    immich.finish(reset);
    expect(resets).toBe(1);
  });

  it("lets the newest run reset the state from another tab, showing nothing there", () => {
    const runs = new CaptionRuns<Mode>();
    let reset = false;
    const url = runs.begin("url");
    expect(url.shows("folder")).toBe(false);
    url.finish(() => {
      reset = true;
    });
    expect(reset).toBe(true);
  });
});
