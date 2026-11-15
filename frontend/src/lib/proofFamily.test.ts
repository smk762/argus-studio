import { describe, expect, it } from "vitest";

import { checkpointFamily, guidanceField } from "@/lib/proofApi";

// Mirrors argus_proof.backends.workflow.checkpoint_family (proof 0.3.0, #228).
describe("checkpointFamily", () => {
  it.each([
    ["flux/flux1-dev.safetensors", "flux"],
    ["FLUX/x.safetensors", "flux"],
    ["flux\\x.safetensors", "flux"],
    ["sdxl/juggernaut.safetensors", "sdxl"],
    ["juggernaut.safetensors", null],
    ["/x.safetensors", null],
  ])("%j -> %j", (name, family) => {
    expect(checkpointFamily(name)).toBe(family);
  });
});

describe("guidanceField", () => {
  it("sends guidance only for a Flux checkpoint with a number >= 0", () => {
    expect(guidanceField("flux/dev.safetensors", "4")).toEqual({ guidance: 4 });
    expect(guidanceField("flux/dev.safetensors", "0")).toEqual({ guidance: 0 });
  });

  it("sends nothing otherwise, so proof applies the family default (or never sees it on SDXL)", () => {
    expect(guidanceField("flux/dev.safetensors", "")).toEqual({});
    expect(guidanceField("flux/dev.safetensors", "-1")).toEqual({});
    expect(guidanceField("flux/dev.safetensors", "abc")).toEqual({});
    expect(guidanceField("sdxl/base.safetensors", "4")).toEqual({});
    expect(guidanceField("base.safetensors", "4")).toEqual({});
  });
});
