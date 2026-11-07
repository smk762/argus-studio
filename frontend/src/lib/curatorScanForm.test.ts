import { describe, expect, it } from "vitest";

import {
  buildScanBody,
  defaultCrops,
  defaultCuratorConfig,
  defaultPrefilter,
  type CuratorConfig,
  type Detectors,
} from "@/components/curator/types";
import { cropsProblem, prefilterProblem, scanFormProblem } from "@/lib/curatorScanForm";

const form = (patch: Partial<CuratorConfig>): CuratorConfig => ({ ...defaultCuratorConfig(), ...patch });
const detectors = (extra: Partial<Detectors>) => extra as Detectors;
const faces = (extra: object) => ({ ...defaultCuratorConfig().faces, ...extra });

describe("prefilterProblem", () => {
  it("passes a form with no rule on", () => {
    expect(prefilterProblem(form({}), null)).toBeNull();
  });

  it("needs face detection, or every frame would look faceless", () => {
    const cfg = form({ prefilter: { ...defaultPrefilter(), drop_no_face: true } });
    expect(prefilterProblem(cfg, null)).toMatch(/Face Clustering/);
    expect(prefilterProblem({ ...cfg, faces: faces({ enabled: true }) }, null)).toBeNull();
  });

  it("needs MiVOLO for the age rule", () => {
    const cfg = form({ prefilter: { ...defaultPrefilter(), drop_no_age: true }, faces: faces({ enabled: true }) });
    expect(prefilterProblem(cfg, null)).toMatch(/MiVOLO/);
    expect(prefilterProblem({ ...cfg, faces: faces({ enabled: true, mivolo: true }) }, null)).toBeNull();
  });

  it("needs NudeNet, and does not guess before /detectors answers", () => {
    const cfg = form({ prefilter: { ...defaultPrefilter(), drop_nsfw: true } });
    expect(prefilterProblem(cfg, detectors({ nudenet: false }))).toMatch(/NudeNet/);
    expect(prefilterProblem(cfg, detectors({ nudenet: true }))).toBeNull();
    expect(prefilterProblem(cfg, null)).toBeNull();
  });
});

describe("cropsProblem", () => {
  const detect = form({ crops: { ...defaultCrops(), enabled: true, detect: true } });

  it("needs a detector URL", () => {
    expect(cropsProblem(detect, detectors({}))).toMatch(/ARGUS_CURATOR_WATERMARK_URL/);
    expect(cropsProblem(detect, detectors({ watermark: true }))).toBeNull();
  });

  it("ignores detect while crops are off", () => {
    expect(cropsProblem(form({ crops: { ...defaultCrops(), detect: true } }), detectors({}))).toBeNull();
  });
});

describe("scanFormProblem", () => {
  it("names the first problem", () => {
    const cfg = form({
      prefilter: { ...defaultPrefilter(), drop_no_face: true },
      crops: { ...defaultCrops(), enabled: true, detect: true },
    });
    expect(scanFormProblem(cfg, detectors({}))).toMatch(/Face Clustering/);
  });
});

describe("buildScanBody", () => {
  it("leaves the blocks out unless asked for", () => {
    const body = buildScanBody("f", form({}));
    expect(body).not.toHaveProperty("prefilter");
    expect(body).not.toHaveProperty("crops");
  });

  it("sends them when they are on", () => {
    const prefilter = { ...defaultPrefilter(), drop_nsfw: true };
    const crops = { ...defaultCrops(), enabled: true };
    expect(buildScanBody("f", form({ prefilter, crops }))).toMatchObject({ prefilter, crops });
  });
});
