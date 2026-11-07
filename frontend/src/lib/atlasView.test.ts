import { describe, expect, it } from "vitest";
import type { AtlasDoctor, Grid, JobSidecar, LabelCollection, OsmExtract } from "@/lib/atlasApi";
import {
  bboxText,
  canvasFraction,
  controlLayers,
  doctorChecks,
  doctorSummary,
  formatSeconds,
  isSafeId,
  isVrt,
  labelsCredit,
  lonLatToMercator,
  notTileableReason,
  osmExtractName,
  placeLabels,
  stageTimings,
} from "@/lib/atlasView";

// A 1000 x 500 canvas whose top-left is the null island, 100 m pixels.
const grid: Grid = {
  crs: "EPSG:3857",
  width: 1000,
  height: 500,
  ulx: 0,
  uly: 0,
  pixel_width: 100,
  pixel_height: -100,
};

/** Degrees for a Web Mercator metre position, written out independently of the code under test. */
const lonOf = (x: number) => (x / 6378137) * (180 / Math.PI);
const latOf = (y: number) => (2 * Math.atan(Math.exp(y / 6378137)) - Math.PI / 2) * (180 / Math.PI);

const point = (name: string, lon: number, lat: number, rank = 0) => ({
  type: "Feature" as const,
  properties: { name, rank, kind: "town" },
  geometry: { type: "Point", coordinates: [lon, lat] },
});
const fc = (...features: LabelCollection["features"]): LabelCollection => ({ type: "FeatureCollection", features });

describe("label placement", () => {
  it("projects like atlas's mercator module", () => {
    const [x, y] = lonLatToMercator(180, 85.05112878);
    expect(x).toBeCloseTo(20037508.342789244, 3);
    expect(y).toBeCloseTo(20037508.34, 0);
    expect(lonLatToMercator(0, 0)).toEqual([0, 0]);
    // Sirmione, as argus_atlas.mercator.lonlat_to_mercator gives it.
    const [gx, gy] = lonLatToMercator(10.607, 45.493);
    expect(gx).toBeCloseTo(1180765.8388, 3);
    expect(gy).toBeCloseTo(5699471.0507, 3);
  });

  it("clamps a latitude past the Web Mercator cap", () => {
    expect(lonLatToMercator(0, 89)[1]).toBe(lonLatToMercator(0, 85.05112878)[1]);
  });

  it("measures y from the top of a north-up canvas", () => {
    // uly 0, so a point 25,000 m south of it is halfway down 500 px of 100 m.
    const { x, y } = canvasFraction(lonOf(25000), latOf(-25000), grid);
    expect(x).toBeCloseTo(0.25, 6);
    expect(y).toBeCloseTo(0.5, 6);
  });

  it("keeps only points on the canvas", () => {
    const { labels, total } = placeLabels(
      fc(
        point("in", lonOf(50000), latOf(-25000)),
        point("east of it", lonOf(100001), latOf(-25000)),
        point("north of it", lonOf(50000), latOf(1)),
      ),
      grid,
    );
    expect(labels.map((l) => l.name)).toEqual(["in"]);
    expect(total).toBe(1);
  });

  it("skips anything that is not a usable point", () => {
    const empty = { ...point("empty", 0, 0), geometry: { type: "Point", coordinates: [] } };
    const line = { ...point("line", 0, 0), geometry: { type: "LineString", coordinates: [0, 0] } };
    expect(placeLabels(fc(empty, line), grid).labels).toEqual([]);
  });

  it("holds back the least important names first and reports the full count", () => {
    const { labels, total } = placeLabels(
      fc(
        point("hamlet", lonOf(1000), latOf(-1000), 4),
        point("city", lonOf(2000), latOf(-1000), 0),
        point("town", lonOf(3000), latOf(-1000), 1),
      ),
      grid,
      2,
    );
    expect(labels.map((l) => l.name)).toEqual(["city", "town"]);
    expect(total).toBe(3);
  });

  it("credits the source the record names", () => {
    expect(labelsCredit("osm")).toContain("OpenStreetMap");
    expect(labelsCredit("naturalearth")).toContain("Natural Earth");
    expect(labelsCredit(null)).toBeNull();
  });
});

describe("stage timings", () => {
  it("reads at a scale that suits the number", () => {
    expect(formatSeconds(0.421)).toBe("0.42 s");
    expect(formatSeconds(12.34)).toBe("12.3 s");
    expect(formatSeconds(59.97)).toBe("1m 00s");
    expect(formatSeconds(125)).toBe("2m 05s");
  });

  it("puts stages in pipeline order, unknown ones last, and sums them", () => {
    const { stages, total } = stageTimings({ tiles: 2, zebra: 1, generate: 40, controls: 3, aardvark: 1 });
    expect(stages.map((s) => s.stage)).toEqual(["controls", "generate", "tiles", "aardvark", "zebra"]);
    expect(total).toBe("47.0 s");
  });

  it("is empty for a job older than timings", () => {
    expect(stageTimings(undefined)).toEqual({ stages: [], total: null });
    expect(stageTimings({})).toEqual({ stages: [], total: null });
  });

  it("drops a value that isn't a number of seconds", () => {
    expect(stageTimings({ crop: Number.NaN }).stages).toEqual([]);
  });
});

describe("inputs", () => {
  const extract = (over: Partial<OsmExtract>): OsmExtract => ({
    name: "osm/garda",
    bbox: null,
    zoom: 11,
    osm_base: null,
    layers: {},
    ...over,
  });

  it("reads the bbox text osm.json records, and a list", () => {
    expect(bboxText("10.6,45.44,10.76,45.6")).toBe("10.6,45.44,10.76,45.6");
    expect(bboxText([10.6, 45.44, 10.76, 45.6])).toBe("10.6,45.44,10.76,45.6");
    expect(bboxText([1, 2])).toBe("");
    expect(bboxText(null)).toBe("");
  });

  it("never burns places as a control", () => {
    const layers = { water: "osm/garda/water.geojson", places: "osm/garda/places.geojson" };
    expect(controlLayers(extract({ layers }))).toEqual({ water: "osm/garda/water.geojson" });
    expect(controlLayers(undefined)).toBeUndefined();
  });

  it("names a fetched extract the way /inputs does", () => {
    expect(osmExtractName("garda")).toBe("osm/garda");
  });

  it("applies atlas's id charset", () => {
    expect(isSafeId("garda-1.2_b")).toBe(true);
    for (const bad of ["", ".hidden", "..", "a/b", "a b", "-x"]) expect(isSafeId(bad)).toBe(false);
  });

  it("spots a VRT whatever its case", () => {
    expect(isVrt("alps/mosaic.vrt")).toBe(true);
    expect(isVrt("alps/mosaic.VRT")).toBe(true);
    expect(isVrt("alps/dem.tif")).toBe(false);
  });
});

describe("notTileableReason", () => {
  const ref = { path: "fantasy_chunk.tif", sha256: "a".repeat(64) };
  const sidecar = (over: object) =>
    ({
      chunk: { z: 11, x: 1, y: 2, size: 512, margin: 64, inner: grid, neighbours: [], image: null },
      bake: { aligned: true, error: "crop failed: disk full" },
      ...over,
    }) as unknown as JobSidecar;

  it("catches an aligned chunk whose crop failed, quoting the record", () => {
    expect(notTileableReason(sidecar({}))).toBe("Chunk 11/1/2 has no cropped tile to cut (crop failed: disk full). Bake it again.");
  });

  it("clears a chunk with its crop", () => {
    const chunk = { z: 11, x: 1, y: 2, image: ref };
    expect(notTileableReason(sidecar({ chunk }))).toBeNull();
  });

  it("leaves a plain canvas and an unaligned bake to their own handling", () => {
    expect(notTileableReason(sidecar({ chunk: null }))).toBeNull();
    expect(notTileableReason(sidecar({ bake: { aligned: false, error: "gate" } }))).toBeNull();
    expect(notTileableReason(sidecar({ bake: null }))).toBeNull();
  });
});

describe("doctor", () => {
  const healthy: AtlasDoctor = {
    gdal: {
      version: "GDAL 3.11.4",
      tools: { gdalinfo: "/usr/bin/gdalinfo", gdalwarp: "/usr/bin/gdalwarp" },
      tiler: "/usr/bin/gdal2tiles.py",
    },
    pmtiles: { library: "pmtiles (python library)", cli: null },
    backend: { name: "comfyui", reachable: true, version: "0.3.1", detail: null },
    bake_allowed: true,
    jobs_dir: "/data/out/atlas",
    dem_dir: "/data/dem",
    models_dir: "/data/models",
    workflow: "packaged template",
  };
  const state = (doctor: AtlasDoctor, label: string) => doctorChecks(doctor).find((c) => c.label === label);

  it("passes a host that can bake", () => {
    const checks = doctorChecks(healthy);
    expect(checks.every((c) => c.state === "ok")).toBe(true);
    expect(doctorSummary(checks)).toBe("Ready to bake");
  });

  it("treats an unreachable backend as off, not broken, while baking is off", () => {
    const doctor = {
      ...healthy,
      bake_allowed: false,
      backend: { name: "comfyui", reachable: false, version: null, detail: "connection refused" },
    };
    expect(state(doctor, "Backend")).toEqual({
      label: "Backend",
      state: "off",
      detail: "comfyui unreachable: connection refused",
    });
    expect(doctorSummary(doctorChecks(doctor))).toBe("Ready for controls and tiles; baking is off");
  });

  it("fails an unreachable backend once baking is on", () => {
    const doctor = { ...healthy, backend: { ...healthy.backend, reachable: false } };
    expect(state(doctor, "Backend")?.state).toBe("fail");
    expect(doctorSummary(doctorChecks(doctor))).toBe("Needs attention: Backend");
  });

  it("names the GDAL tools that are missing", () => {
    const doctor = { ...healthy, gdal: { ...healthy.gdal, tools: { gdalinfo: "/x", gdalwarp: null } } };
    expect(state(doctor, "GDAL")).toEqual({ label: "GDAL", state: "fail", detail: "missing gdalwarp" });
  });

  it("does not count the Go pmtiles CLI as a packer", () => {
    const doctor = { ...healthy, pmtiles: { library: null, cli: "/usr/bin/pmtiles" } };
    expect(state(doctor, "PMTiles packer")?.state).toBe("fail");
  });

  it("fails a host with no tiler", () => {
    const doctor = { ...healthy, gdal: { ...healthy.gdal, tiler: null } };
    expect(state(doctor, "Tiler")?.state).toBe("fail");
  });
});
