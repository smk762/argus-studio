import { describe, expect, it } from "vitest";

import {
  buildScanBody,
  defaultCrops,
  defaultCuratorConfig,
  defaultPrefilter,
  facesBody,
  type CuratorConfig,
  type Detectors,
} from "@/components/curator/types";
import { cropsProblem, modelProblem, prefilterProblem, scanFormProblem } from "@/lib/curatorScanForm";

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

describe("modelProblem", () => {
  it("names a model the form asks for and the curator lacks", () => {
    expect(modelProblem(form({ faces: faces({ fairface: true }) }), detectors({}))).toMatch(/FairFace/);
    expect(modelProblem(form({ faces: faces({ set_age: true }) }), detectors({}))).toMatch(/MiVOLO/);
    expect(modelProblem(form({ faces: faces({ mivolo_body: true }) }), detectors({ mivolo: true }))).toMatch(/Read bodies/);
    const scenes = { ...defaultCuratorConfig().scenes, enabled: true };
    expect(modelProblem(form({ scenes }), detectors({}))).toMatch(/Places365/);
    expect(modelProblem(form({ scenes }), detectors({ places365: true }))).toBeNull();
  });

  it("does not guess before /detectors answers", () => {
    expect(modelProblem(form({ faces: faces({ fairface: true }) }), null)).toBeNull();
  });
});

describe("facesBody", () => {
  it("applies the curator's implications", () => {
    expect(facesBody(faces({ set_age: true }))).toMatchObject({ enabled: true, mivolo: true });
    expect(facesBody(faces({ mivolo_body: true }))).toMatchObject({ enabled: true, mivolo: true });
    expect(facesBody(faces({ fairface: true }))).toMatchObject({ enabled: true, mivolo: false });
    expect(facesBody(faces({}))).toMatchObject({ enabled: false, mivolo: false });
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
    expect(body).not.toHaveProperty("scenes");
    expect(body).not.toHaveProperty("garments");
  });

  it("sends scenes and garments when they are on", () => {
    const base = defaultCuratorConfig();
    const body = buildScanBody("f", form({ scenes: { ...base.scenes, enabled: true }, garments: { ...base.garments, enabled: true } }));
    expect(body).toMatchObject({ scenes: { enabled: true, top_k: 5 }, garments: { enabled: true, min_conf: 0.3 } });
  });

  it("sends them when they are on", () => {
    const prefilter = { ...defaultPrefilter(), drop_nsfw: true };
    const crops = { ...defaultCrops(), enabled: true };
    expect(buildScanBody("f", form({ prefilter, crops }))).toMatchObject({ prefilter, crops });
  });
});
