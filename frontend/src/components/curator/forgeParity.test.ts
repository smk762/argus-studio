import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";

import { demoKohyaFiles } from "./forgeDemo";
import {
  CATEGORY_LABELS,
  DATASET_SIZE_GUIDE,
  TARGET_CATEGORIES,
  type TargetCategory,
  datasetSizeStatus,
  suggestTrainingParams,
} from "./types";

// argus-forge's answers for a grid of cases, pinned in schema/pins.json like a
// wire schema (argus-forge#45). types.ts and forgeDemo.ts are hand-written twins
// of forge's heuristics.py and kohya emitter: the /curate panel must show the
// numbers forge writes, and demo mode must hand out the config forge would.
// When forge changes, the daily wire-drift job re-pulls this file and these
// tests fail until the twins follow.
interface ForgeParams {
  images: number;
  repeats: number;
  epochs: number;
  total_steps: number;
  optimizer_steps: number;
  network_dim: number;
  network_alpha: number;
  unet_lr: number;
  text_encoder_lr: number;
  optimizer: string;
  scheduler: string;
  resolution: number;
  batch_size: number;
  precision: string;
}

interface ParityFixture {
  parity_version: string;
  categories: Record<string, { label: string; size_guide: { ideal: string; low: number; hi: number } }>;
  suggest_training_params: { count: number; category: TargetCategory; params: ForgeParams }[];
  dataset_size_status: { count: number; category: TargetCategory; tone: string; text: string }[];
  kohya: { count: number; category: TargetCategory; trigger: string; files: Record<string, unknown> }[];
}

const fixture: ParityFixture = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "..", "schema", "forge-parity.json"), "utf8"),
);

/** Studio's params in forge's shape: snake_case, learning rates as numbers, optimizer steps derived. */
function asForge(count: number, category: TargetCategory): ForgeParams {
  const p = suggestTrainingParams(count, category);
  return {
    images: p.images,
    repeats: p.repeats,
    epochs: p.epochs,
    total_steps: p.totalSteps,
    optimizer_steps: Math.ceil(p.totalSteps / p.batchSize),
    network_dim: p.networkDim,
    network_alpha: p.networkAlpha,
    unet_lr: Number(p.unetLr),
    text_encoder_lr: Number(p.textEncoderLr),
    optimizer: p.optimizer,
    scheduler: p.scheduler,
    resolution: p.resolution,
    batch_size: p.batchSize,
    precision: p.precision,
  };
}

const label = (r: { count: number; category: string }) => `${r.category} x ${r.count}`;

describe("argus-forge parity fixture", () => {
  it("is a version this test reads", () => {
    expect(fixture.parity_version.split(".")[0]).toBe("1");
  });

  it("has the same categories, labels and size guides", () => {
    expect([...TARGET_CATEGORIES].sort()).toEqual(Object.keys(fixture.categories).sort());
    for (const c of TARGET_CATEGORIES) {
      expect(CATEGORY_LABELS[c], c).toBe(fixture.categories[c].label);
      expect(DATASET_SIZE_GUIDE[c], c).toEqual(fixture.categories[c].size_guide);
    }
  });

  it.each(fixture.suggest_training_params.map((r) => [label(r), r] as const))(
    "suggestTrainingParams: %s",
    (_, r) => {
      expect(asForge(r.count, r.category)).toEqual(r.params);
    },
  );

  it.each(fixture.dataset_size_status.map((r) => [label(r), r] as const))("datasetSizeStatus: %s", (_, r) => {
    expect(datasetSizeStatus(r.count, r.category)).toEqual({ tone: r.tone, text: r.text });
  });

  // Compared parsed: the demo's comments and float spellings (1e-4 vs 0.0001) may differ, its values may not.
  it.each(fixture.kohya.map((r) => [label(r), r] as const))("demo kohya TOML: %s", (_, r) => {
    const files = Object.fromEntries(
      demoKohyaFiles(r.count, r.category, r.trigger).map((f) => [f.name, parse(f.content)]),
    );
    expect(files).toEqual(r.files);
  });
});
