import { describe, expect, it } from "vitest";
import { type ImageResult, MANIFEST_VERSION, manifestFace } from "@/components/curator/types";
import curator from "../../schema/curator-wire.schema.json";

describe("pinned wire schemas", () => {
  it("stamps the manifest version the curator schema declares", () => {
    expect(curator.$defs.ManifestRow.properties.manifest_version.default).toBe(MANIFEST_VERSION);
  });
});

describe("manifestFace", () => {
  const row = (faces: ImageResult["faces"]) => ({ rel_path: "a", faces }) as ImageResult;

  it("is null without a primary face", () => {
    expect(manifestFace(row([]))).toBeNull();
    expect(manifestFace(row([{ bbox: [0, 0, 9, 9], det_score: 0.9, cluster_id: null, primary: false, yaw: null, pitch: null, pose: null }]))).toBeNull();
  });

  it("copies the primary face's readings and nulls what an older curator left out", () => {
    const face = manifestFace(
      row([
        { bbox: [0, 0, 9, 9], det_score: 0.9, cluster_id: null, primary: false, yaw: 1, pitch: 1, pose: null },
        {
          bbox: [10, 20, 30, 40],
          det_score: 0.95,
          cluster_id: "c0",
          primary: true,
          yaw: 5,
          pitch: -3,
          pose: "frontal",
          roll: 2,
          sharpness: 0.8,
          attributes: { age_years: 31 } as NonNullable<ImageResult["faces"][number]["attributes"]>,
        },
      ]),
    );
    expect(face).toEqual({
      bbox: [10, 20, 30, 40],
      yaw: 5,
      pitch: -3,
      roll: 2,
      sharpness: 0.8,
      eye_open: null,
      mouth_open: null,
      cluster_distance: null,
      reference_distance: null,
      age_years: 31,
      landmarks: null,
    });
  });
});
