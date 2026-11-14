import { describe, expect, it } from "vitest";
import {
  CATEGORY_LABELS,
  DATASET_SIZE_GUIDE,
  TARGET_CATEGORIES,
  datasetSizeStatus,
  suggestTrainingParams,
} from "./types";

// Pinned against argus-forge v0.2.0 heuristics.py (suggest_training_params /
// dataset_size_status), which ports these line for line. A change here needs
// the same change there, or forge writes configs the /curate panel didn't show.
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
    expect(datasetSizeStatus(25, "concept")).toEqual({
      tone: "good",
      text: "25 selected — in the ~30–60 sweet spot for an SDXL Concept / Style LoRA.",
    });
    expect(datasetSizeStatus(100, "concept").tone).toBe("good");
    expect(datasetSizeStatus(101, "concept").tone).toBe("high");
  });
});
