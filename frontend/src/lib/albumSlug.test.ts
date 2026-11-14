import { describe, expect, it } from "vitest";
import { albumSlug } from "./albumSlug";

describe("albumSlug", () => {
  it("keeps ASCII names as before", () => {
    expect(albumSlug("  Summer trip 2024 ", "a1")).toBe("Summer_trip_2024");
    expect(albumSlug("a/b\\c", "a1")).toBe("a_b_c");
  });

  it("keeps non-ASCII letters so distinct albums get distinct folders", () => {
    const a = albumSlug("Портреты 2023", "a1");
    const b = albumSlug("Пейзажи 2023", "a2");
    expect(a).toBe("Портреты_2023");
    expect(b).toBe("Пейзажи_2023");
    expect(a).not.toBe(b);
    expect(albumSlug("東京の写真", "a3")).toBe("東京の写真");
  });

  it("never yields a traversal or hidden segment", () => {
    expect(albumSlug("../..", "x")).toBe("immich_x");
    expect(albumSlug(".hidden", "x")).toBe("hidden");
  });

  it("falls back to the album id, not a shared folder", () => {
    expect(albumSlug("🌅🌄", "abc-123")).toBe("immich_abc-123");
    expect(albumSlug("🌅", "def-456")).not.toBe(albumSlug("🌄", "abc-123"));
  });
});
