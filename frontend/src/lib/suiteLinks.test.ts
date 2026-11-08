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

  it("links argus-sightline when configured", () => {
    const links = suiteLinks({ lightbox: "", cull: "", safelight: "", sightline: "http://localhost:3107" });
    expect(links).toEqual([{ label: "Sightline", service: "argus-survey", href: "http://localhost:3107" }]);
  });
});
