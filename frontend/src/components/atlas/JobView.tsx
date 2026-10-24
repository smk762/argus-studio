"use client";

import { useState } from "react";
import {
  archiveUrl,
  cutTiles,
  previewUrl,
  type AtlasJob,
  type AtlasPreset,
  type JobStatus,
} from "@/lib/atlasApi";
import { type Capability } from "@/lib/capabilities";
import { BakePanel } from "@/components/atlas/BakePanel";

export const STATUS_DOT: Record<JobStatus, string> = {
  controls: "bg-muted",
  baked: "bg-accent-amber",
  unaligned: "bg-accent-red",
  tiled: "bg-accent-green",
};

const STATUS_LABEL: Record<JobStatus, string> = {
  controls: "Controls ready",
  baked: "Baked + aligned",
  unaligned: "Failed the alignment gate",
  tiled: "Tiled",
};

/** Base controls first, then the operator's layers, in a stable order. */
const BASE_ORDER = ["composite", "hillshade", "slope", "land", "sea"];

function short(sha: string): string {
  return sha.slice(0, 12);
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-mono text-xs text-foreground">{value}</div>
    </div>
  );
}

/**
 * One canvas: the controls GDAL wrote, the painted image laid over them on the
 * same pixel grid, the bake + tiles steps, and the provenance that makes a bake
 * reproducible. Because the painted pixels sit inside a geotransform atlas fixed
 * *before* generation, fading between a control and the bake shows the terrain
 * stayed put — the in-studio stand-in for atlas's MapLibre drape viewer.
 */
export function JobView({
  job,
  presets,
  canBake,
  onChanged,
}: {
  job: AtlasJob;
  presets: AtlasPreset[];
  canBake: Capability;
  onChanged: () => void;
}) {
  const s = job.sidecar;
  const controlKinds = Object.keys(s.controls).sort((a, b) => {
    const ia = BASE_ORDER.indexOf(a);
    const ib = BASE_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  const [base, setBase] = useState(controlKinds[0] ?? "hillshade");
  const [opacity, setOpacity] = useState(70);
  const [tiling, setTiling] = useState(false);
  const [tilesError, setTilesError] = useState<string | null>(null);
  const [showCommands, setShowCommands] = useState(false);

  const bake = s.bake;
  const tiles = s.tiles;
  const painted = bake ? previewUrl(s.job_id, "fantasy", bake.completed_at) : null;

  const tile = async () => {
    setTiling(true);
    setTilesError(null);
    try {
      await cutTiles(s.job_id);
      onChanged();
    } catch (err) {
      setTilesError(err instanceof Error ? err.message : "Tiling failed");
    } finally {
      setTiling(false);
    }
  };

  const { west, south, east, north } = s.bbox;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[job.status]}`} />
        <h2 className="font-mono text-base text-foreground">{s.job_id}</h2>
        <span className="text-xs text-muted">{STATUS_LABEL[job.status]}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Canvas" value={`${s.grid.width} × ${s.grid.height} px`} />
        <Stat label="Ground resolution" value={`${s.resolution.toFixed(1)} m/px`} />
        <Stat label="Native zoom" value={`z${s.native_zoom} (tiles z${s.zoom_range[0]}–${s.zoom_range[1]})`} />
        <Stat label="CRS" value={s.grid.crs} />
        <Stat
          label="AOI (W,S,E,N)"
          value={<span title={`${west},${south},${east},${north}`}>{[west, south, east, north].map((v) => v.toFixed(3)).join(", ")}</span>}
        />
      </div>

      {/* Control / painted overlay on the shared pixel grid */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {controlKinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setBase(k)}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
                base === k ? "border-accent-blue/60 bg-accent-blue/10 text-accent-blue" : "border-border text-muted hover:bg-surface-hover"
              }`}
            >
              {k}
            </button>
          ))}
          {painted && (
            <label className="ml-auto flex items-center gap-2 text-[11px] text-muted">
              control
              <input
                type="range"
                min={0}
                max={100}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                aria-label="Painted map opacity"
                className="w-40 accent-[var(--accent-blue)]"
              />
              painted
            </label>
          )}
        </div>
        <div
          className="relative mx-auto w-full overflow-hidden rounded-lg border border-border bg-surface"
          // Width capped so a portrait canvas still fits in the viewport's height.
          style={{
            aspectRatio: `${s.grid.width} / ${s.grid.height}`,
            maxWidth: `min(48rem, calc(70vh * ${s.grid.width / s.grid.height}))`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- served by the atlas API, not a Next asset */}
          <img src={previewUrl(s.job_id, base)} alt={`${base} control`} className="absolute inset-0 h-full w-full object-contain" />
          {painted && (
            // eslint-disable-next-line @next/next/no-img-element -- served by the atlas API, not a Next asset
            <img
              src={painted}
              alt="painted map"
              className="absolute inset-0 h-full w-full object-contain"
              style={{ opacity: opacity / 100 }}
            />
          )}
        </div>
        {!painted && (
          <p className="text-center text-[11px] text-muted">
            Not baked yet. If the relief looks right, the georeferencing is already fixed; a bake only changes pixel colours.
          </p>
        )}
      </section>

      {bake && (
        <section className="space-y-2 rounded-xl border border-border bg-surface/50 px-5 py-4">
          <h3 className="text-xs font-semibold tracking-widest text-muted uppercase">Last bake</h3>
          {!bake.aligned && (
            <p className="text-xs text-accent-red">
              Alignment gate failed{bake.error ? `: ${bake.error}` : ""}. The PNG is kept for inspection; no GeoTIFF was written.
            </p>
          )}
          <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            <div><dt className="inline text-muted">Preset </dt><dd className="inline font-mono">{bake.params.preset ?? "—"}</dd></div>
            <div><dt className="inline text-muted">Seed </dt><dd className="inline font-mono">{bake.params.seed}</dd></div>
            <div>
              <dt className="inline text-muted">Checkpoint </dt>
              <dd className="inline font-mono" title={bake.checkpoint.sha256}>{bake.checkpoint.name} · {short(bake.checkpoint.sha256)}</dd>
            </div>
            <div>
              <dt className="inline text-muted">LoRA </dt>
              <dd className="inline font-mono" title={bake.lora?.sha256}>
                {bake.lora ? `${bake.lora.name} @ ${bake.params.lora_weight} · ${short(bake.lora.sha256)}` : "none"}
              </dd>
            </div>
            <div>
              <dt className="inline text-muted">Sampling </dt>
              <dd className="inline font-mono">
                {bake.params.steps} steps · cfg {bake.params.cfg} · denoise {bake.params.denoise} · {bake.params.sampler}/{bake.params.scheduler}
              </dd>
            </div>
            <div><dt className="inline text-muted">Engine </dt><dd className="inline font-mono">{bake.backend} {bake.engine_version}</dd></div>
          </dl>
          <p className="text-xs text-foreground/80">{bake.params.prompt}</p>
        </section>
      )}

      {/* Tiles: only an aligned GeoTIFF can be cut */}
      {bake?.aligned && (
        <section className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface/50 px-5 py-4">
          <h3 className="text-xs font-semibold tracking-widest text-muted uppercase">PMTiles</h3>
          {tiles ? (
            <>
              <span className="font-mono text-xs text-foreground">
                {tiles.n_tiles} tiles · z{tiles.min_zoom}–{tiles.max_zoom}
              </span>
              <a
                href={archiveUrl(s.job_id)}
                className="rounded-lg border border-accent-blue/40 bg-accent-blue/10 px-3 py-1.5 text-xs font-medium text-accent-blue hover:bg-accent-blue/20"
              >
                Download fantasy.pmtiles
              </a>
              <span className="text-[11px] text-muted">
                Drape it on a basemap with argus-atlas&apos;s <span className="font-mono">examples/viewer.html</span>.
              </span>
            </>
          ) : (
            <button
              type="button"
              onClick={tile}
              disabled={tiling}
              className="rounded-lg bg-accent-blue px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {tiling ? "Cutting tiles…" : "Cut PMTiles archive"}
            </button>
          )}
          {tilesError && <span className="text-xs text-accent-red">{tilesError}</span>}
        </section>
      )}

      <BakePanel key={s.job_id} jobId={s.job_id} presets={presets} canBake={canBake} onBaked={onChanged} />

      {/* Provenance */}
      <section className="space-y-2">
        <button
          type="button"
          onClick={() => setShowCommands((v) => !v)}
          className="flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-foreground"
        >
          <span>{showCommands ? "▾" : "▸"}</span>
          Provenance: DEM {short(s.dem.sha256)} · {s.commands.length} GDAL commands
        </button>
        {showCommands && (
          <div className="space-y-1 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[11px] text-muted">
            <div>dem {s.dem.path} · {s.dem.sha256}</div>
            {Object.entries(s.layer_sources).map(([name, ref]) => (
              <div key={name}>layer {name} {ref.path} · {short(ref.sha256)}</div>
            ))}
            {s.commands.map((c, i) => (
              <div key={i} className="break-all text-foreground/70">{c.argv.join(" ")}</div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
