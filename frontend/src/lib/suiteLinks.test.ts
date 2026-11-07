import { describe, expect, it } from "vitest";

import { suiteLinks } from "@/lib/suiteLinks";

describe("suiteLinks", () => {
  it("has no links, and so no literal fallback, when nothing is configured", () => {
    expect(suiteLinks({ lightbox: "", cull: "", safelight: "" })).toEqual([]);
  });

  it("omits only the UIs with no URL", () => {
    const links = suiteLinks({ lightbox: "", cull: "https://cull.example", safelight: "/safelight" });
    expect(links.map((link) => [link.label, link.href])).toEqual([
      ["Cull", "https://cull.example"],
      ["Safelight", "/safelight"],
    ]);
  });
});
