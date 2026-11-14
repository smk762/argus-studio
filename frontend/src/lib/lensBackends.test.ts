import { describe, expect, it } from "vitest";

import { backendList, backendsLabel } from "@/lib/lensApi";

// GET /backends is a name-keyed map; a backend that failed to instantiate comes
// back with only name/available/reason (argus_lens.engine.available_backends).

describe("backendList", () => {
  it("lists available backends first, then by name, keeping unavailable ones and their reason", () => {
    const out = backendList({
      wd14: { name: "wd14", kind: "tags", available: false, reason: "onnxruntime not installed" },
      hybrid: { name: "hybrid", kind: "composite", available: true, reason: null },
      florence2: { name: "florence2", kind: "prose", requires_gpu: true, available: true },
      blip: { name: "blip", available: false, reason: "boom" },
    });
    expect(out.map((b) => b.name)).toEqual(["florence2", "hybrid", "blip", "wd14"]);
    expect(out[3].reason).toBe("onnxruntime not installed");
  });

  it("takes a missing name from the key and treats a non-true available as unavailable", () => {
    const out = backendList({ ram: { kind: "tags" }, x: null });
    expect(out).toEqual([
      { name: "ram", kind: "tags", available: false },
      { name: "x", available: false },
    ]);
  });

  it("returns nothing for a missing map", () => {
    expect(backendList(undefined)).toEqual([]);
  });
});

describe("backendsLabel", () => {
  it("counts available over registered", () => {
    expect(backendsLabel(backendList({ a: { available: true }, b: { available: false }, c: { available: true } }))).toBe(
      "2/3 backends",
    );
  });

  it("is empty for no backends, so the caller can fall back", () => {
    expect(backendsLabel([])).toBe("");
  });
});
