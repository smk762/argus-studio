import { describe, expect, it } from "vitest";

import { slugify } from "@/lib/slug";

// Audit pack-argus-studio-db891766bb: combining marks are part of the word.
describe("slugify", () => {
  it("keeps combining marks (Devanagari, decomposed accents)", () => {
    expect(slugify("हिन्दी")).toBe("हिन्दी");
    expect(slugify("café menu")).toBe("café-menu");
    expect(slugify("Café menu")).toBe(slugify("Café menu"));
  });

  it("still strips punctuation and hyphenates spaces", () => {
    expect(slugify("  Hello, World!  ")).toBe("hello-world");
    expect(slugify("概要")).toBe("概要");
  });
});
