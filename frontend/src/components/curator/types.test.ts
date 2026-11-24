import { describe, expect, it } from "vitest";
import {
  CATEGORY_LABELS,
  DATASET_SIZE_GUIDE,
  TARGET_CATEGORIES,
  buildScanBody,
  datasetSizeStatus,
  defaultCuratorConfig,
  defaultPrefilter,
  prefilterOn,
  suggestTrainingParams,
} from "./types";

// Readable spot checks for the concept category. forgeParity.test.ts is what
// keeps these tables equal to argus-forge's heuristics.py (the whole grid, from
// forge's pinned schema/forge-parity.json): a change here needs the same change
// there, or forge writes configs the /curate panel didn't show.
describe("concept target category (argus-forge 0.2.0 parity)", () => {
  it("is offered alongside the other four", () => {
    expect(TARGET_CATEGORIES).toEqual(["identity", "wardrobe", "pose_composition", "setting", "concept"]);
    expect(CATEGORY_LABELS.concept).toBe("Concept / Style");
    expect(DATASET_SIZE_GUIDE.concept).toEqual({ ideal: "30–60", low: 20, hi: 100 });
  });

  it("trains like a scene set: 2000 target steps at dim 32 / alpha 16", () => {
    const p = suggestTrainingParams(25, "concept");
    expect(p).toMatchObject({ images: 25, repeats: 8, epochs: 10, totalSteps: 2000, networkDim: 32, networkAlpha: 16 });
    expect(suggestTrainingParams(7, "concept")).toMatchObject({ repeats: 29, totalSteps: 2030 });
    expect(suggestTrainingParams(333, "concept")).toMatchObject({ repeats: 1, totalSteps: 3330 });
  });

  it("grades set size against 20..100", () => {
    expect(datasetSizeStatus(0, "concept")).toEqual({
      tone: "empty",
      text: "Aim for ~30–60 sharp, varied images for an SDXL Concept / Style LoRA.",
    });
    expect(datasetSizeStatus(19, "concept").tone).toBe("low");
    expect(datasetSizeStatus(20, "concept").tone).toBe("good");
    // Inside low..hi but outside the ideal band: still good, but not "in the sweet spot".
    expect(datasetSizeStatus(25, "concept")).toEqual({
      tone: "good",
      text: "25 selected — workable for an SDXL Concept / Style LoRA; the sweet spot is ~30–60.",
    });
    expect(datasetSizeStatus(45, "concept")).toEqual({
      tone: "good",
      text: "45 selected — in the ~30–60 sweet spot for an SDXL Concept / Style LoRA.",
    });
    expect(datasetSizeStatus(41, "identity").text).toBe(
      "41 selected — workable for an SDXL Identity LoRA; the sweet spot is ~15–30.",
    );
    expect(datasetSizeStatus(100, "concept").tone).toBe("good");
    expect(datasetSizeStatus(101, "concept").tone).toBe("high");
  });
});

// Audit pack-argus-studio-68d8655dc4: a junk-only prefilter was left out of the request.
describe("prefilterOn", () => {
  it("is off by default, and the block is not sent", () => {
    expect(prefilterOn(defaultPrefilter())).toBe(false);
    expect(buildScanBody("/data/images", defaultCuratorConfig())).not.toHaveProperty("prefilter");
  });

  it.each(Object.keys(defaultPrefilter()))("%s alone sends the block", (flag) => {
    const cfg = defaultCuratorConfig();
    cfg.prefilter = { ...defaultPrefilter(), [flag]: true };
    expect(prefilterOn(cfg.prefilter)).toBe(true);
    expect(buildScanBody("/data/images", cfg)).toMatchObject({ prefilter: { [flag]: true } });
  });
});
