import { describe, expect, it } from "vitest";
import { albumSlug } from "./albumSlug";

const ID = "3f2a9c1e-7b4d-4e8a-9f00-123456789abc";

describe("albumSlug", () => {
  it("slugs ASCII names and adds a short album-id suffix", () => {
    expect(albumSlug("  Summer trip 2024 ", ID)).toBe("Summer_trip_2024_3f2a9c1e");
    expect(albumSlug("a/b\\c", "a1")).toBe("a_b_c_a1");
  });

  it("keeps non-ASCII letters so distinct albums get distinct folders", () => {
    const a = albumSlug("Портреты 2023", "a1");
    const b = albumSlug("Пейзажи 2023", "a2");
    expect(a).toBe("Портреты_2023_a1");
    expect(b).toBe("Пейзажи_2023_a2");
    expect(albumSlug("東京の写真", "a3")).toBe("東京の写真_a3");
  });

  it("never maps two albums whose names slug alike to one folder", () => {
    const names = ["Portraits 2023", "Portraits_2023", "Portraits / 2023", "Portraits & 2023"];
    const folders = names.map((n, i) => albumSlug(n, `album-${i}`));
    expect(new Set(folders).size).toBe(names.length);
    expect(albumSlug("Faces!", "id-a")).not.toBe(albumSlug("Faces?", "id-b"));
  });

  it("caps a long name to fit a 255-byte folder name, on a code-point boundary", () => {
    const enc = new TextEncoder();
    for (const ch of ["я", "東", "𝒜", "a"]) {
      const slug = albumSlug(ch.repeat(300), ID);
      expect(enc.encode(slug).length).toBeLessThanOrEqual(255);
      expect(slug).not.toContain("�");
      expect(slug.endsWith("_3f2a9c1e")).toBe(true);
      expect(new TextDecoder().decode(enc.encode(slug))).toBe(slug); // no lone surrogate
    }
  });

  it("never yields a traversal or hidden segment", () => {
    expect(albumSlug("../..", "x")).toBe("immich_x");
    expect(albumSlug(".hidden", "x")).toBe("hidden_x");
  });

  it("falls back to the album id, not a shared folder", () => {
    expect(albumSlug("🌅🌄", "abc-123")).toBe("immich_abc-123");
    expect(albumSlug("🌅", "def-456")).not.toBe(albumSlug("🌄", "abc-123"));
  });
});
