import { describe, expect, it } from "vitest";

import { defaultCuratorConfig, type Detectors } from "@/components/curator/types";
import { clearDenied } from "@/lib/scanConfigCaps";

const on = () => {
  const c = defaultCuratorConfig();
  return {
    ...c,
    faces: { ...c.faces, set_age: true },
    prefilter: { ...c.prefilter, drop_nsfw: true, drop_no_face: true, drop_no_age: true },
    crops: { ...c.crops, enabled: true, detect: true },
  };
};

describe("clearDenied", () => {
  it("switches off every option the curator refuses", () => {
    const out = clearDenied(on(), { setAge: false, prefilter: false, crops: false, watermarkDenied: true });
    expect(out.faces.set_age).toBe(false);
    expect([out.prefilter.drop_nsfw, out.prefilter.drop_no_face, out.prefilter.drop_no_age]).toEqual([false, false, false]);
    expect(out.crops.enabled).toBe(false);
    expect(out.crops.detect).toBe(false);
  });

  it("leaves options alone while /health is unknown, or allows them", () => {
    const c = on();
    expect(clearDenied(c, { setAge: null, prefilter: null, crops: null, watermarkDenied: false })).toBe(c);
    expect(clearDenied(c, { setAge: true, prefilter: true, crops: true, watermarkDenied: false })).toBe(c);
  });
});

// Audit pack-argus-studio-8c9b0e1890: a control that is not drawn can't be switched off by hand.
describe("clearDenied: detectors", () => {
  const allowed = { setAge: true, prefilter: true, crops: true, watermarkDenied: false } as const;
  const gated = () => {
    const c = defaultCuratorConfig();
    return {
      ...c,
      faces: { ...c.faces, fairface: true, mivolo: true, set_age: true, mivolo_body: true },
      scenes: { ...c.scenes, enabled: true },
      garments: { ...c.garments, enabled: true },
    };
  };
  const detectors = (extra: Partial<Detectors> = {}): Detectors => ({ torch: true, cuda: false, clip: true, insightface: true, onnxruntime: true, ...extra });

  it("switches off every option whose detector the curator lacks", () => {
    const out = clearDenied(gated(), { ...allowed, detectors: detectors() });
    expect(out.faces).toMatchObject({ fairface: false, mivolo: false, set_age: false, mivolo_body: false });
    expect(out.scenes.enabled).toBe(false);
    expect(out.garments.enabled).toBe(false);
  });

  it("clears body ages alone when only the person detector is missing", () => {
    const out = clearDenied(gated(), { ...allowed, detectors: detectors({ fairface: true, mivolo: true, places365: true, garments: true }) });
    expect(out.faces).toMatchObject({ fairface: true, mivolo: true, set_age: true, mivolo_body: false });
    expect(out.scenes.enabled).toBe(true);
    expect(out.garments.enabled).toBe(true);
  });

  it("changes nothing while /detectors is unknown, or lists everything", () => {
    const c = gated();
    expect(clearDenied(c, { ...allowed, detectors: null })).toBe(c);
    expect(clearDenied(c, allowed)).toBe(c);
    expect(clearDenied(c, { ...allowed, detectors: detectors({ fairface: true, mivolo: true, bodies: true, places365: true, garments: true }) })).toBe(c);
  });
});
