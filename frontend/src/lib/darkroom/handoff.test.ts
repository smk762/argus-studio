import { describe, expect, it } from "vitest";

import { defaultCompose } from "@/lib/darkroom/compose";
import { applyHandoff, composeFromCatalogue, darkroomHandoffHref, matchModel, parseHandoff } from "@/lib/darkroom/handoff";
import type { Models } from "@/lib/darkroomApi";

const S = (c: string) => c.repeat(64);
const MANIFEST = {
  run_id: "proof-sabine-v3",
  base_checkpoint: { name: "sdxl/juggernaut.safetensors", sha256: S("a") },
  loras: [
    { name: "loras/sabine.safetensors", sha256: S("b"), weight: 0.8 },
    { name: "loras/film-grain.safetensors", sha256: S("c"), weight: 0.35 },
  ],
};
const MODELS: Models = {
  default_checkpoint: "base.safetensors",
  // Darkroom files the checkpoint under another name: sha256 is what matches.
  checkpoints: [{ name: "base.safetensors" }, { name: "juggernaut-xl.safetensors", sha256: S("a") }],
  loras: [{ name: "loras/sabine.safetensors", trigger_words: ["sks woman"] }],
  vaes: [],
  samplers: ["dpmpp_2m"],
  schedulers: ["karras"],
};

const params = (href: string) => new URLSearchParams(href.split("?")[1]);

describe("handoff URL", () => {
  it("round-trips a manifest's checkpoint and LoRAs, in order", () => {
    const h = parseHandoff(params(darkroomHandoffHref(MANIFEST)));
    expect(h).toEqual({
      from: "proof-sabine-v3",
      checkpoint: { name: "sdxl/juggernaut.safetensors", sha256: S("a") },
      loras: [
        { name: "loras/sabine.safetensors", sha256: S("b"), weight: 0.8 },
        { name: "loras/film-grain.safetensors", sha256: S("c"), weight: 0.35 },
      ],
    });
  });

  it("is null without models, and drops a malformed sha or weight", () => {
    expect(parseHandoff(new URLSearchParams("from=x"))).toBeNull();
    const h = parseHandoff(new URLSearchParams("checkpoint=a&checkpoint_sha256=zz&lora=l&lora_sha256=&lora_weight=nope"));
    expect(h?.checkpoint).toEqual({ name: "a", sha256: null });
    expect(h?.loras).toEqual([{ name: "l", sha256: null, weight: 1 }]);
  });

  it("reads a blank weight as the default, not 0", () => {
    const h = parseHandoff(new URLSearchParams("lora=l&lora_weight=&lora=m&lora_weight=%20"));
    expect(h?.loras.map((l) => l.weight)).toEqual([1, 1]);
  });
});

describe("a malformed manifest", () => {
  it("hands off a plain /darkroom instead of throwing, and skips nameless LoRAs", () => {
    expect(darkroomHandoffHref({ run_id: "x" } as never)).toBe("/darkroom");
    expect(darkroomHandoffHref({ run_id: "x", base_checkpoint: {} } as never)).toBe("/darkroom");
    const h = parseHandoff(params(darkroomHandoffHref({ run_id: "x", base_checkpoint: { name: "a" }, loras: [{} as never, { name: "l" }] })));
    expect(h?.loras.map((l) => l.name)).toEqual(["l"]);
  });
});

describe("matchModel", () => {
  it("prefers sha256, then the exact name, never a near name", () => {
    expect(matchModel({ name: "x", sha256: S("a") }, MODELS.checkpoints)?.name).toBe("juggernaut-xl.safetensors");
    expect(matchModel({ name: "base.safetensors", sha256: null }, MODELS.checkpoints)?.name).toBe("base.safetensors");
    expect(matchModel({ name: "base", sha256: null }, MODELS.checkpoints)).toBeNull();
  });
});

describe("applyHandoff", () => {
  const base = defaultCompose(null, null, MODELS);

  it("selects what darkroom has and names what it lacks", () => {
    const r = applyHandoff(base, parseHandoff(params(darkroomHandoffHref(MANIFEST)))!, MODELS);
    expect(r.state.checkpoint).toBe("juggernaut-xl.safetensors");
    expect(r.state.loras).toEqual([{ name: "loras/sabine.safetensors", weight: 0.8, trigger_words: ["sks woman"] }]);
    expect(r.applied).toEqual(["juggernaut-xl.safetensors", "loras/sabine.safetensors @ 0.8"]);
    expect(r.missing).toEqual(["loras/film-grain.safetensors"]);
  });

  it("keeps the form's checkpoint when darkroom lacks the handed-off one", () => {
    const r = applyHandoff(base, { from: null, checkpoint: { name: "gone.safetensors", sha256: S("f") }, loras: [] }, MODELS);
    expect(r.state.checkpoint).toBe("base.safetensors");
    expect(r.missing).toEqual(["gone.safetensors"]);
  });
});

// Audit pack-argus-studio-786c824c9e: the handoff lands on the server's defaults, not the placeholder form.
describe("composeFromCatalogue", () => {
  const POLICIES = { default: "adult-granular", policies: [] } as never;
  const incoming = parseHandoff(params(darkroomHandoffHref(MANIFEST)));
  const placeholder = defaultCompose(null, null, null);
  const defaults = defaultCompose(null, POLICIES, MODELS);

  it("applies a handoff over the server defaults on an untouched form", () => {
    const state = composeFromCatalogue(placeholder, false, null, POLICIES, MODELS, incoming);
    expect(state.checkpoint).toBe("juggernaut-xl.safetensors");
    expect(state.loras.map((l) => l.name)).toEqual(["loras/sabine.safetensors"]);
    expect(state.enforcingPolicy).toBe(defaults.enforcingPolicy);
    expect(state.enforcingPolicy).not.toBe(placeholder.enforcingPolicy);
    // Running the updater again, as React may, gives the same form.
    expect(composeFromCatalogue(placeholder, false, null, POLICIES, MODELS, incoming)).toEqual(state);
  });

  it("gives the defaults with no handoff, and keeps a touched form", () => {
    expect(composeFromCatalogue(placeholder, false, null, POLICIES, MODELS, null)).toEqual(defaults);
    const typed = { ...defaults, prompt: "a lemon" };
    expect(composeFromCatalogue(typed, true, null, POLICIES, MODELS, incoming)).toMatchObject({ prompt: "a lemon", checkpoint: "juggernaut-xl.safetensors" });
  });
});
