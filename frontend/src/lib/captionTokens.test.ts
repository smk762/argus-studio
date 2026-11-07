import { describe, expect, it } from "vitest";

import { estimateTokens, isT5Backend, sizedForBackend, tokenBudget, tokenBudgetsOf, tokenUse } from "@/lib/captionTokens";
import { TARGET_BACKENDS, type CaptionResult } from "@/types";

const result = (metadata: Record<string, unknown>) => ({ metadata }) as unknown as CaptionResult;

describe("estimateTokens", () => {
  // Expected values come from running lens v0.10.0's token_budget.py on each text.
  it.each([
    ["", 0, 0],
    ["   ", 0, 0],
    ["solo", 1, 1],
    ["one two three", 3, 3],
    ["a, b, c", 5, 5],
    ["long_hair, blue_eyes, smiling", 7, 5],
    ["a woman in a red dress stands on a pier at dusk, looking out over the water.", 23, 19],
    ["word ".repeat(46), 59, 50],
    ["tag, ".repeat(30), 69, 63],
  ])("matches lens on %j", (text, clip, t5) => {
    expect(estimateTokens(text, "sdxl")).toBe(clip);
    expect(estimateTokens(text, "flux")).toBe(t5);
  });

  it("treats a backend it does not know as CLIP, as lens does", () => {
    expect(estimateTokens("long_hair", "something-new")).toBe(estimateTokens("long_hair", "sdxl"));
  });

  it("normalizes the backend name", () => {
    expect(isT5Backend(" FLUX ")).toBe(true);
    expect(isT5Backend("playground")).toBe(false);
  });
});

describe("tokenBudgetsOf", () => {
  it("reads lens's budgets", () => {
    expect(tokenBudgetsOf({ sdxl: 60, flux: 200 })).toEqual({ sdxl: 60, flux: 200 });
  });

  it("reads anything else as no budgets", () => {
    for (const raw of [undefined, null, "60", 60, [60]]) expect(tokenBudgetsOf(raw)).toEqual({});
  });

  it("drops values that are not usable budgets", () => {
    expect(tokenBudgetsOf({ a: "60", b: 0, c: -1, d: null, e: Number.NaN, f: 75 })).toEqual({ f: 75 });
  });
});

describe("tokenBudget", () => {
  it("prefers lens's figure over the built-in table", () => {
    expect(tokenBudget("sdxl", { sdxl: 75 })).toBe(75);
  });

  it("falls back to the built-in table when lens gave none", () => {
    for (const backend of TARGET_BACKENDS) expect(tokenBudget(backend.value)).toBe(backend.tokens);
  });

  it("uses lens's default for a backend nothing knows", () => {
    expect(tokenBudget("something-new", { sdxl: 75 })).toBe(60);
  });

  it("normalizes the name as lens does", () => {
    expect(tokenBudget(" Flux ")).toBe(200);
  });
});

describe("tokenUse", () => {
  it("is not over at exactly the budget, matching lens's comparison", () => {
    expect(tokenUse("word ".repeat(46), "sdxl", { sdxl: 59 })).toEqual({ used: 59, budget: 59, over: false });
  });

  it("is over one token past it", () => {
    expect(tokenUse("word ".repeat(46), "sdxl", { sdxl: 58 })).toEqual({ used: 59, budget: 58, over: true });
  });

  it("measures the same text differently per backend", () => {
    const text = "tag, ".repeat(30);
    expect(tokenUse(text, "sdxl").over).toBe(true);
    expect(tokenUse(text, "flux").over).toBe(false);
  });
});

describe("sizedForBackend", () => {
  const replay = (recorded_profile: unknown) => result({ replay: { recorded_profile } });

  it("is the requested backend for a fresh caption", () => {
    expect(sizedForBackend(result({}), "sdxl")).toBe("sdxl");
  });

  it("is the recorded backend for a replay", () => {
    expect(sizedForBackend(replay({ target_backend: "flux" }), "sdxl")).toBe("flux");
  });

  it("keeps the requested backend when the record does not say", () => {
    for (const profile of [undefined, null, "flux", {}, { target_backend: 200 }, { target_backend: " " }]) {
      expect(sizedForBackend(replay(profile), "sdxl")).toBe("sdxl");
    }
    expect(sizedForBackend(result({ replay: "cortex" }), "sdxl")).toBe("sdxl");
  });

  it("survives a result with no metadata", () => {
    expect(sizedForBackend({} as CaptionResult, "sdxl")).toBe("sdxl");
  });
});
