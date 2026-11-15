import { describe, expect, it } from "vitest";

import { defaultCuratorConfig } from "@/components/curator/types";
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
