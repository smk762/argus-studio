"use client";

import { useEffect, useRef, useState } from "react";
import { fetchOsm, OSM_DEFAULT_LAYERS, OSM_LAYERS, type OsmResult } from "@/lib/atlasApi";
import { osmExtractName, isSafeId } from "@/lib/atlasView";
import { capabilityReason, permits, type Capability } from "@/lib/capabilities";
import { CapabilityNotice } from "@/components/CapabilityNotice";
import { Field, inputClass } from "@/components/atlas/fields";

/**
 * Ask the atlas host to fetch OSM layers for the AOI (`POST /osm`). The form stays
 * visible on a host without `ATLAS_ALLOW_OSM=1`, with the reason it is inert.
 * The result is an extract under ATLAS_DEM_DIR, so the parent reloads `/inputs`.
 */
export function OsmFetch({
  bbox,
  existing,
  canOsm,
  canGdal,
  onFetched,
}: {
  /** The AOI field's text, already stripped of spaces. */
  bbox: string;
  /** Extract names `/inputs` listed, so a name about to be replaced can say so. */
  existing: string[];
  canOsm: Capability;
  canGdal: Capability;
  onFetched: (extract: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [zoom, setZoom] = useState("11");
  const [layers, setLayers] = useState<string[]>([...OSM_DEFAULT_LAYERS]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OsmResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Overpass can take minutes; don't leave the request running behind a closed form.
  const ctrlRef = useRef<AbortController | null>(null);
  useEffect(() => () => ctrlRef.current?.abort(), []);

  const reason =
    canOsm === true
      ? capabilityReason(canGdal, "GDAL is missing on this host, and it splits the extract into layers.")
      : capabilityReason(
          canOsm,
          "Fetching OSM from the server is off on this host. Set ATLAS_ALLOW_OSM=1 to enable it, or fetch with the argus-atlas osm command into ATLAS_DEM_DIR.",
        );
  const sealed = canOsm === false || canGdal === false;

  const zoomLevel = Number(zoom);
  const zoomOk = zoom.trim() !== "" && Number.isInteger(zoomLevel) && zoomLevel >= 0 && zoomLevel <= 19;
  const nameOk = isSafeId(name.trim());
  const ready = nameOk && zoomOk && layers.length > 0 && bbox.split(",").length === 4;
  const replacing = nameOk && existing.includes(osmExtractName(name.trim()));

  const toggle = (layer: string) =>
    setLayers((current) => (current.includes(layer) ? current.filter((l) => l !== layer) : [...current, layer]));

  const submit = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const fetched = await fetchOsm({ name: name.trim(), bbox, zoom: zoomLevel, layers }, ctrl.signal);
      setResult(fetched);
      await onFetched(osmExtractName(fetched.name));
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Could not fetch OSM");
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
      if (ctrlRef.current === ctrl) ctrlRef.current = null;
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border px-4 py-3">
      <h3 className="text-[11px] uppercase tracking-wide text-muted">Fetch OSM layers for this AOI</h3>
      {sealed && reason && <CapabilityNotice reason={reason} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Extract name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={sealed}
            placeholder="garda"
            className={inputClass}
          />
        </Field>
        <Field label="Zoom (use the canvas's native zoom)">
          <input
            value={zoom}
            onChange={(e) => setZoom(e.target.value)}
            disabled={sealed}
            inputMode="numeric"
            className={inputClass}
          />
        </Field>
      </div>
      <fieldset disabled={sealed} className="flex flex-wrap gap-x-4 gap-y-1 disabled:opacity-50">
        <legend className="sr-only">OSM layers</legend>
        {OSM_LAYERS.map((layer) => (
          <label key={layer} className="flex items-center gap-1.5 text-xs text-foreground">
            <input
              type="checkbox"
              checked={layers.includes(layer)}
              onChange={() => toggle(layer)}
              className="accent-[var(--accent-blue)]"
            />
            {layer}
            {layer === "buildings" && <span className="text-[10px] text-muted">z13+</span>}
          </label>
        ))}
      </fieldset>
      {name.trim() !== "" && !nameOk && (
        <p className="text-xs text-accent-red">Use letters, digits, &quot;.&quot;, &quot;_&quot; or &quot;-&quot;, starting with a letter or digit.</p>
      )}
      {replacing && <p className="text-xs text-accent-orange">This replaces the extract {osmExtractName(name.trim())}.</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={!ready || busy || !permits(canOsm) || !permits(canGdal)}
          title={reason ?? undefined}
          className="rounded-lg border border-accent-blue/40 bg-accent-blue/10 px-3 py-1.5 text-xs font-medium text-accent-blue transition-opacity hover:bg-accent-blue/20 disabled:opacity-40"
        >
          {busy ? "Asking Overpass…" : "Fetch OSM"}
        </button>
        {error && <span className="text-xs text-accent-red">{error}</span>}
        {result && (
          <span className="text-xs text-muted">
            Fetched {Object.keys(result.layers).join(", ") || "no layers"} into {osmExtractName(result.name)}
            {result.skipped.length > 0 ? `; ${result.skipped.join(", ")} empty at this zoom` : ""}.
          </span>
        )}
      </div>
    </div>
  );
}
