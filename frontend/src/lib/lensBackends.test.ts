import { describe, expect, it } from "vitest";

import { backendChoices, backendField, backendInfo, backendList, backendsLabel } from "@/lib/lensApi";

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

// lens#107: /backends gains {default, allowed} and per-entry `allowed`; every
// caption endpoint takes an optional `backend`. An older lens ignores the field,
// so the picker only appears when /backends names a default.

const NEW_SHAPE = backendInfo({
  default: "hybrid",
  allowed: ["hybrid", "florence2"],
  backends: {
    hybrid: { name: "hybrid", available: true, allowed: true },
    florence2: { name: "florence2", available: true, allowed: true, requires_gpu: true },
    wd14: { name: "wd14", available: true, allowed: false },
    openai: { name: "openai", available: false, allowed: true, reason: "Missing package" },
  },
});

describe("backendInfo", () => {
  it("reads the new shape", () => {
    expect(NEW_SHAPE.default).toBe("hybrid");
    expect(NEW_SHAPE.allowed).toEqual(["hybrid", "florence2"]);
    expect(NEW_SHAPE.backends.map((b) => b.name)).toEqual(["florence2", "hybrid", "wd14", "openai"]);
  });

  it("reads an older lens's bare map as no default and no pin", () => {
    const old = backendInfo({ backends: { hybrid: { available: true } } });
    expect(old).toEqual({ default: null, allowed: null, backends: [{ name: "hybrid", available: true }] });
  });
});

describe("backendChoices", () => {
  it("offers the default plus available, allowed backends", () => {
    expect(backendChoices(NEW_SHAPE).map((b) => b.name)).toEqual(["florence2", "hybrid"]);
  });

  it("offers nothing on an older lens, or when only the default is pickable", () => {
    expect(backendChoices(backendInfo({ backends: { hybrid: { available: true }, wd14: { available: true } } }))).toEqual([]);
    const onlyDefault = backendInfo({
      default: "hybrid",
      backends: { hybrid: { available: true }, wd14: { available: true, allowed: false } },
    });
    expect(backendChoices(onlyDefault)).toEqual([]);
    expect(backendChoices(null)).toEqual([]);
  });
});

describe("backendField", () => {
  it("sends a pickable non-default choice", () => {
    expect(backendField("florence2", NEW_SHAPE)).toEqual({ backend: "florence2" });
  });

  it("sends nothing for the default, an unset choice, or one the server won't take", () => {
    expect(backendField("", NEW_SHAPE)).toEqual({});
    expect(backendField("hybrid", NEW_SHAPE)).toEqual({});
    expect(backendField("wd14", NEW_SHAPE)).toEqual({}); // not allowed
    expect(backendField("openai", NEW_SHAPE)).toEqual({}); // unavailable
    expect(backendField("gone", NEW_SHAPE)).toEqual({});
  });

  it("sends nothing to an older lens, which would ignore it", () => {
    expect(backendField("wd14", backendInfo({ backends: { wd14: { available: true } } }))).toEqual({});
  });
});
