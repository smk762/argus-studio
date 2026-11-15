import { describe, expect, it } from "vitest";

import { defaultCompose } from "@/lib/darkroom/compose";
import { applyHandoff, darkroomHandoffHref, matchModel, parseHandoff } from "@/lib/darkroom/handoff";
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
