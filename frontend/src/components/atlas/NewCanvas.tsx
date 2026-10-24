"use client";

import { useState } from "react";
import { createControls, type AtlasInputs } from "@/lib/atlasApi";

export const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted/60 focus:border-accent-blue focus:outline-none disabled:opacity-50";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

/** An OSM extract's bbox as the `west,south,east,north` string the form edits. */
function bboxText(bbox: number[] | null): string {
  return bbox && bbox.length === 4 ? bbox.join(",") : "";
}

/**
 * Plan a canvas and write its GDAL controls (`POST /controls`). CPU only, so
 * atlas serves it even on a host where baking is off: a visitor can always see
 * how the AOI lands on the Web Mercator grid before anyone spends a GPU bake.
 *
 * Inputs are *names under the server's ATLAS_DEM_DIR*, picked from
 * `GET /inputs`; studio never sends a filesystem path.
 */
export function NewCanvas({
  inputs,
  onCreated,
}: {
  inputs: AtlasInputs | null;
  onCreated: (jobId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dem, setDem] = useState("");
  const [bbox, setBbox] = useState("");
  const [extract, setExtract] = useState("");
  const [sizing, setSizing] = useState<"long_side" | "resolution">("long_side");
  const [longSide, setLongSide] = useState("1024");
  const [resolution, setResolution] = useState("");
  const [seaLevel, setSeaLevel] = useState("");
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dems = inputs?.dems ?? [];
  const extracts = inputs?.osm ?? [];
  const chosen = extracts.find((e) => e.name === extract);

  const pickExtract = (name: string) => {
    setExtract(name);
    const e = extracts.find((x) => x.name === name);
    // An extract was fetched for one bbox; start from it, the operator can still narrow it.
    if (e && !bbox.trim()) setBbox(bboxText(e.bbox));
  };

  const num = (v: string) => (v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
  const ready = dem && bbox.split(",").length === 4;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const job = await createControls({
        dem,
        bbox: bbox.replace(/\s+/g, ""),
        layers: chosen?.layers,
        sea_level: num(seaLevel),
        long_side: sizing === "long_side" ? num(longSide) : undefined,
        resolution: sizing === "resolution" ? num(resolution) : undefined,
        job_id: jobId.trim() || undefined,
      });
      onCreated(job.job_id);
      setOpen(false);
      setJobId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the controls");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-surface/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-medium text-foreground">New canvas</span>
        <span className="text-xs text-muted">{open ? "Hide" : "DEM + AOI → hillshade, slope and layer controls (no GPU)"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-5 py-4">
          {dems.length === 0 && (
            <p className="text-xs text-muted">
              No DEMs found under <span className="font-mono">{inputs?.root ?? "ATLAS_DEM_DIR"}</span>. Put a GeoTIFF
              (or a GDAL <span className="font-mono">.vrt</span> mosaic) there, e.g. Copernicus GLO-30, and reload.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="DEM">
              <select value={dem} onChange={(e) => setDem(e.target.value)} className={inputClass}>
                <option value="">— choose a DEM —</option>
                {dems.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="OSM layers (optional)">
              <select value={extract} onChange={(e) => pickExtract(e.target.value)} className={inputClass}>
                <option value="">none — hillshade only</option>
                {extracts.map((e) => (
                  <option key={e.name} value={e.name}>
                    {e.name} ({Object.keys(e.layers).join(", ")})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Job id (optional)">
              <input value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="garda-1" className={inputClass} />
            </Field>
          </div>
          <Field label="AOI (west,south,east,north in degrees)">
            <input
              value={bbox}
              onChange={(e) => setBbox(e.target.value)}
              placeholder="10.60,45.44,10.76,45.60"
              className={`${inputClass} font-mono`}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Canvas size by">
              <select
                value={sizing}
                onChange={(e) => setSizing(e.target.value as "long_side" | "resolution")}
                className={inputClass}
              >
                <option value="long_side">long side (px)</option>
                <option value="resolution">ground resolution (m/px)</option>
              </select>
            </Field>
            {sizing === "long_side" ? (
              <Field label="Long side (≤ 1536, multiple of 64)">
                <input value={longSide} onChange={(e) => setLongSide(e.target.value)} inputMode="numeric" className={inputClass} />
              </Field>
            ) : (
              <Field label="Resolution (m/px)">
                <input value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="30" inputMode="decimal" className={inputClass} />
              </Field>
            )}
            <Field label="Sea level (m, coasts)">
              <input value={seaLevel} onChange={(e) => setSeaLevel(e.target.value)} placeholder="unset" inputMode="decimal" className={inputClass} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={submit}
              disabled={!ready || busy}
              className="rounded-lg bg-accent-blue px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Running GDAL…" : "Build controls"}
            </button>
            {error && <span className="text-xs text-accent-red">{error}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
