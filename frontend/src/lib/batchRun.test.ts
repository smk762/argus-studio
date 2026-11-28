import { describe, expect, it } from "vitest";
import { startRun } from "@/lib/batchRun";

describe("startRun", () => {
  // Audit pack-argus-studio-7ed6e26610: a folder run that settles after an Immich run started
  // must not clear the loading flag and progress bar the Immich run now owns.
  it("lets only the newest run reset the shared loading state", () => {
    const counter = { current: 0 };
    let tab = "folder";
    const folder = startRun(counter, () => tab, "folder");
    tab = "immich";
    const immich = startRun(counter, () => tab, "immich");

    const resets: string[] = [];
    folder.settle(() => resets.push("folder"));
    expect(resets).toEqual([]);
    expect(folder.stale()).toBe(true);

    expect(immich.stale()).toBe(false);
    immich.settle(() => resets.push("immich"));
    expect(resets).toEqual(["immich"]);
  });

  it("still resets after the user leaves the tab, though the outcome no longer lands", () => {
    const counter = { current: 0 };
    let tab = "manifest";
    const run = startRun(counter, () => tab, "manifest");
    tab = "folder";
    expect(run.stale()).toBe(true);
    let reset = false;
    run.settle(() => {
      reset = true;
    });
    expect(reset).toBe(true);
  });

  // Audit pack-argus-studio-aea1bd3019: a URL run takes a turn on the same counter, so a slow
  // URL answer can neither land over a newer upload nor re-enable the buttons mid-upload.
  it("makes a URL run and an upload run supersede each other", () => {
    const counter = { current: 0 };
    const tab = () => "upload";
    const url = startRun(counter, tab, "upload");
    const upload = startRun(counter, tab, "upload");
    expect(url.stale()).toBe(true);
    let cleared = false;
    url.settle(() => {
      cleared = true;
    });
    expect(cleared).toBe(false);
    expect(upload.stale()).toBe(false);
  });
});
