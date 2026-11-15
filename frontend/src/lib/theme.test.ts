import { afterEach, describe, expect, it, vi } from "vitest";

import { subscribeScheme } from "@/lib/theme";

// Audit pack-argus-studio-72b82f6432: without dh-theme.js the subscription
// follows the same media query the snapshot reads.
describe("subscribeScheme without window.dhTheme", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("listens to prefers-color-scheme and stops on unsubscribe", () => {
    const added: string[] = [];
    const removed: string[] = [];
    const mq = {
      matches: false,
      addEventListener: (type: string) => added.push(type),
      removeEventListener: (type: string) => removed.push(type),
    };
    const queries: string[] = [];
    vi.stubGlobal("window", {});
    vi.stubGlobal("matchMedia", (q: string) => {
      queries.push(q);
      return mq;
    });
    const unsubscribe = subscribeScheme(() => {});
    expect(queries).toEqual(["(prefers-color-scheme: dark)"]);
    expect(added).toEqual(["change"]);
    unsubscribe();
    expect(removed).toEqual(["change"]);
  });

  it("uses dh-theme's own subscription when it is there", () => {
    const off = () => {};
    vi.stubGlobal("window", { dhTheme: { subscribe: () => off } });
    expect(subscribeScheme(() => {})).toBe(off);
  });
});
