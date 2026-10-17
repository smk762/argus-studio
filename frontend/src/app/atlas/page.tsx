"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ApiVersionBadge } from "@/components/ApiVersionBadge";
import { CapabilityNotice } from "@/components/CapabilityNotice";
import { capabilityReason, permits, type Capability } from "@/lib/capabilities";
import {
  allowsBake,
  archiveUrl,
  bakeStream,
  buildTiles,
  createControls,
  getAtlasHealth,
  getJob,
  listJobs,
  previewUrl,
  type AtlasHealth,
  type AtlasJob,
  type AtlasJobDigest,
  type AtlasJobStatus,
  type BakeProgress,
} from "@/lib/atlasApi";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted/60 focus:border-accent-teal focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const buttonClass =
  "rounded-lg bg-accent-teal px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40";

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Canvas long sides the server accepts: multiples of 64 up to the 1536 cap. */
const LONG_SIDES = [512, 768, 1024, 1280, 1536];

const DEFAULT_PROMPT =
  "antique fantasy map, ink coastlines, parchment, illustrated relief, no text, no labels, no compass rose";

const STATUS_LABEL: Record<AtlasJobStatus, string> = {
  controls: "controls ready",
  baked: "baked · aligned",
  unaligned: "bake failed the gate",
  tiled: "tiled",
};

function statusDot(status: AtlasJobStatus): string {
  if (status === "tiled") return "bg-accent-green";
  if (status === "baked") return "bg-accent-teal";
  if (status === "unaligned") return "bg-accent-red";
  return "bg-accent-amber";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}

/**
 * Job form: a DEM *name* under the server's ATLAS_DEM_DIR, an AOI, an optional
 * land polygon file name, and the canvas long side. Runs GDAL only, so it is
 * available on a GPU-less host.
 */
function NewJob({ onCreated, gdalMissing }: { onCreated: (job: AtlasJob) => void; gdalMissing: boolean }) {
  const [open, setOpen] = useState(false);
  const [dem, setDem] = useState("");
  const [bbox, setBbox] = useState("");
  const [land, setLand] = useState("");
  const [longSide, setLongSide] = useState("1024");
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = dem.trim() !== "" && bbox.trim().split(",").length === 4;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const job = await createControls({
        dem: dem.trim(),
        bbox: bbox.trim(),
        land: land.trim() || undefined,
        long_side: Number(longSide),
        job_id: jobId.trim() || undefined,
      });
      onCreated(job);
      setOpen(false);
    } catch (err) {
      setError(errMsg(err));
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
        <span className="text-sm font-medium text-foreground">New job</span>
        <span className="text-xs text-muted">{open ? "Hide" : "Warp a DEM into hillshade + slope controls (no GPU)"}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-border px-5 py-4">
          {gdalMissing && (
            <CapabilityNotice reason="The atlas server reports no GDAL installation, so it cannot build controls or tiles. Use the published image, or install gdal-bin where it runs." />
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="DEM (name under ATLAS_DEM_DIR)">
              <input value={dem} onChange={(e) => setDem(e.target.value)} placeholder="dem.tif" className={inputClass} />
            </Field>
            <Field label="Bounding box (west,south,east,north — degrees)">
              <input value={bbox} onChange={(e) => setBbox(e.target.value)} placeholder="10.02,45.01,10.18,45.09" className={inputClass} />
            </Field>
            <Field label="Land polygon file (optional, same root)">
              <input value={land} onChange={(e) => setLand(e.target.value)} placeholder="land.gpkg" className={inputClass} />
            </Field>
            <Field label="Canvas long side (px)">
              <select value={longSide} onChange={(e) => setLongSide(e.target.value)} className={inputClass}>
                {LONG_SIDES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Job id (optional)">
              <input value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="aoi-1" className={inputClass} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={submit} disabled={!ready || busy || gdalMissing} className={buttonClass}>
              {busy ? "Running GDAL…" : "Build controls"}
            </button>
            {error && <span className="text-xs text-accent-red">{error}</span>}
            <span className="text-[11px] text-muted/70">
              The canvas is planned in EPSG:3857 before anything is painted; its geotransform becomes the job&apos;s
              coordinate authority.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

/** The bake panel for one job: gated by the server's bake capability (#66-style). */
function BakePanel({
  job,
  canBake,
  onBaked,
}: {
  job: AtlasJob;
  canBake: Capability;
  onBaked: () => void;
}) {
  const [checkpoint, setCheckpoint] = useState("sd_xl_base_1.0.safetensors");
  const [lora, setLora] = useState("");
  const [weight, setWeight] = useState("0.8");
  const [denoise, setDenoise] = useState("0.55");
  const [seed, setSeed] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [running, setRunning] = useState(false);
  const [frames, setFrames] = useState<BakeProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  // The stream outlives the panel on navigation; abort it on teardown.
  const ctrlRef = useRef<AbortController | null>(null);
  useEffect(() => () => ctrlRef.current?.abort(), []);

  const denoiseVal = Number(denoise);
  const ready = checkpoint.trim() !== "" && Number.isFinite(denoiseVal) && denoiseVal > 0 && denoiseVal <= 1;
  const sealed = canBake === false;
  const deniedReason =
    "Live baking is disabled on this host — it paints on a GPU through ComfyUI. Set ATLAS_ALLOW_BAKE=1 on the atlas server to enable it; controls, tiles and stored jobs stay available meanwhile.";

  const start = async () => {
    setRunning(true);
    setError(null);
    setFrames([]);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const seedNum = Number(seed);
      await bakeStream(
        {
          job_id: job.job_id,
          checkpoint: checkpoint.trim(),
          lora: lora.trim() || undefined,
          lora_weight: Number.isFinite(Number(weight)) ? Number(weight) : 0.8,
          denoise: denoiseVal,
          seed: seed.trim() !== "" && Number.isInteger(seedNum) && seedNum >= 0 ? seedNum : undefined,
          prompt: prompt.trim() || undefined,
        },
        (p) => setFrames((f) => [...f, p]),
        ctrl.signal,
      );
      onBaked();
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(errMsg(err));
      onBaked(); // a failed gate still updates the sidecar (PNG kept, no GeoTIFF)
    } finally {
      if (!ctrl.signal.aborted) setRunning(false);
      if (ctrlRef.current === ctrl) ctrlRef.current = null;
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface/50 px-5 py-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Bake</h3>
        <span className="text-xs text-muted">img2img through ComfyUI, stamped back to the canvas grid</span>
      </div>
      {sealed ? (
        <CapabilityNotice reason={deniedReason} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Base checkpoint">
              <input value={checkpoint} onChange={(e) => setCheckpoint(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Cartography LoRA (optional)">
              <input value={lora} onChange={(e) => setLora(e.target.value)} placeholder="fantasy_map.safetensors" className={inputClass} />
            </Field>
            <Field label="LoRA weight">
              <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" className={inputClass} />
            </Field>
            <Field label="Denoise (img2img strength)">
              <input value={denoise} onChange={(e) => setDenoise(e.target.value)} inputMode="decimal" className={inputClass} />
            </Field>
            <Field label="Seed (random if empty)">
              <input value={seed} onChange={(e) => setSeed(e.target.value)} inputMode="numeric" className={inputClass} />
            </Field>
          </div>
          <Field label="Prompt">
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} className={inputClass} />
          </Field>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={start}
              disabled={!ready || running || !permits(canBake)}
              title={capabilityReason(canBake, deniedReason) ?? undefined}
              className={buttonClass}
            >
              {running ? "Baking…" : canBake === null ? "Checking…" : "Bake"}
            </button>
            {error && <span className="text-xs text-accent-red">{error}</span>}
          </div>
          {frames.length > 0 && (
            <ol className="space-y-0.5 font-mono text-[11px] text-muted">
              {frames.map((f, i) => (
                <li key={i} className={f.type === "error" ? "text-accent-red" : f.type === "done" ? "text-accent-green" : ""}>
                  [{f.type}] {f.message}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

export default function AtlasPage() {
  // version: null = loading, "" = unreachable, else the server version.
  const [version, setVersion] = useState<string | null>(null);
  const [health, setHealth] = useState<AtlasHealth | null>(null);
  const [jobs, setJobs] = useState<AtlasJobDigest[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [job, setJob] = useState<AtlasJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tiling, setTiling] = useState(false);
  const [tilesError, setTilesError] = useState<string | null>(null);
  const unreachable = version === "";
  const canBake: Capability = allowsBake(health);
  const gdalMissing = health !== null && health.gdal === null;

  const refreshJobs = useCallback(async (signal?: AbortSignal) => {
    const list = await listJobs(signal);
    setJobs(list);
    return list;
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      // allSettled: a failing /jobs must not discard a /health that answered.
      const [h, list] = await Promise.allSettled([getAtlasHealth(ctrl.signal), refreshJobs(ctrl.signal)]);
      if (ctrl.signal.aborted) return;
      if (h.status === "fulfilled") {
        setVersion(h.value.version);
        setHealth(h.value);
      } else {
        setVersion("");
      }
      if (list.status === "fulfilled" && list.value.length > 0) setSelected((cur) => cur ?? list.value[0].job_id);
    })();
    return () => ctrl.abort();
  }, [refreshJobs]);

  const loadJob = useCallback(async (jobId: string, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setJob(await getJob(jobId, signal));
    } catch (err) {
      if (signal?.aborted) return;
      setError(errMsg(err));
      setJob(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    const ctrl = new AbortController();
    void loadJob(selected, ctrl.signal);
    return () => ctrl.abort();
  }, [selected, loadJob]);

  const onCreated = useCallback(
    async (created: AtlasJob) => {
      try {
        await refreshJobs();
      } catch {
        // best-effort; the job itself still loads below
      }
      setSelected(created.job_id);
      setJob(created);
    },
    [refreshJobs],
  );

  const reloadSelected = useCallback(async () => {
    if (!selected) return;
    try {
      await refreshJobs();
    } catch {
      // list refresh is best-effort
    }
    await loadJob(selected);
  }, [selected, refreshJobs, loadJob]);

  const cutTiles = async () => {
    if (!job) return;
    setTiling(true);
    setTilesError(null);
    try {
      await buildTiles(job.job_id);
      await reloadSelected();
    } catch (err) {
      setTilesError(errMsg(err));
    } finally {
      setTiling(false);
    }
  };

  const sidecar = job?.sidecar;
  const bake = sidecar?.bake ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        active="/atlas"
        logo={{ letter: "A" }}
        title="Argus Atlas"
        subtitle="Georeferenced fantasy-map overlays from real terrain"
        badge={<ApiVersionBadge label="argus-atlas" version={version} prefix="v" />}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {unreachable ? (
          <div className="mx-auto max-w-xl space-y-4 py-24 text-center">
            <h2 className="text-lg font-medium text-foreground/70">The argus-atlas server is not running.</h2>
            <p className="text-sm text-muted">
              Start it with{" "}
              <code className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-xs">docker compose --profile atlas up</code>{" "}
              or <code className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-xs">argus-atlas serve --cors</code> on{" "}
              <span className="font-mono">:8105</span>, or set <span className="font-mono">ARGUS_ATLAS_URL</span> to where it
              is running.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <NewJob onCreated={onCreated} gdalMissing={gdalMissing} />
            <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
              {/* Job browser */}
              <aside className="space-y-1">
                <div className="mb-2 text-[10px] uppercase tracking-wide text-muted">Jobs</div>
                {jobs.length === 0 && <p className="text-sm text-muted">No jobs yet. Build controls from a DEM above.</p>}
                {jobs.map((j) => (
                  <button
                    key={j.job_id}
                    type="button"
                    onClick={() => setSelected(j.job_id)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                      selected === j.job_id ? "border-accent-teal/60 bg-surface" : "border-border bg-surface/40 hover:bg-surface-hover"
                    }`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(j.status)}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs text-foreground">{j.job_id}</span>
                      <span className="block text-[10px] text-muted">
                        {j.width}×{j.height} · z{j.native_zoom} · {STATUS_LABEL[j.status]}
                      </span>
                    </span>
                  </button>
                ))}
              </aside>

              {/* Selected job */}
              <div className="space-y-6">
                {loading && <p className="py-12 text-center text-sm text-muted">Loading job…</p>}
                {error && <p className="py-12 text-center text-sm text-accent-red">{error}</p>}
                {!loading && !error && job && sidecar && (
                  <>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Stat label="Canvas" value={`${sidecar.grid.width} × ${sidecar.grid.height} px`} />
                      <Stat label="Ground resolution" value={`${sidecar.resolution.toFixed(2)} m/px`} />
                      <Stat label="Native zoom" value={`z${sidecar.native_zoom} (archive z${sidecar.zoom_range[0]}–z${sidecar.zoom_range[1]})`} />
                      <Stat label="Status" value={STATUS_LABEL[job.status]} />
                    </div>
                    <p className="font-mono text-[11px] text-muted">
                      bbox {sidecar.bbox.west.toFixed(5)}, {sidecar.bbox.south.toFixed(5)}, {sidecar.bbox.east.toFixed(5)},{" "}
                      {sidecar.bbox.north.toFixed(5)} · {sidecar.grid.crs} · DEM sha256 {sidecar.dem.sha256.slice(0, 12)}…
                    </p>

                    {/* Hillshade versus fantasy, same extent */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <figure className="space-y-1">
                        {/* eslint-disable-next-line @next/next/no-img-element -- cross-origin API image, no optimisation */}
                        <img
                          src={previewUrl(job.job_id, "hillshade", sidecar.created_at)}
                          alt={`Hillshade control for ${job.job_id}`}
                          className="w-full rounded-lg border border-border bg-background"
                        />
                        <figcaption className="text-[11px] text-muted">Hillshade control (model input, no georeferencing of its own)</figcaption>
                      </figure>
                      <figure className="space-y-1">
                        {bake ? (
                          // eslint-disable-next-line @next/next/no-img-element -- cross-origin API image
                          <img
                            src={previewUrl(job.job_id, "fantasy", bake.completed_at)}
                            alt={`Painted map for ${job.job_id}`}
                            className={`w-full rounded-lg border bg-background ${bake.aligned ? "border-border" : "border-accent-red/60"}`}
                          />
                        ) : (
                          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
                            Not baked yet
                          </div>
                        )}
                        <figcaption className="text-[11px] text-muted">
                          {bake
                            ? bake.aligned
                              ? `Fantasy overlay · ${bake.params.checkpoint}${bake.params.lora ? ` + ${bake.params.lora} @ ${bake.params.lora_weight}` : ""} · seed ${bake.params.seed} · denoise ${bake.params.denoise} · aligned`
                              : `Alignment gate FAILED — PNG kept, no GeoTIFF written: ${bake.error ?? "size or corners differ from the sidecar"}`
                            : "Fantasy overlay (appears after a bake passes the alignment gate)"}
                        </figcaption>
                      </figure>
                    </div>

                    <BakePanel key={job.job_id} job={job} canBake={canBake} onBaked={reloadSelected} />

                    {/* Tiles: a separate step so a bad stylisation is rejected before a pyramid is built */}
                    <section className="space-y-3 rounded-xl border border-border bg-surface/50 px-5 py-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-foreground">PMTiles archive</h3>
                        <span className="text-xs text-muted">zoom {sidecar.zoom_range[0]}–{sidecar.zoom_range[1]}, bounded to the AOI</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <button
                          type="button"
                          onClick={cutTiles}
                          disabled={tiling || !bake || !bake.aligned || gdalMissing}
                          title={!bake?.aligned ? "Needs a bake that passed the alignment gate" : undefined}
                          className={buttonClass}
                        >
                          {tiling ? "Cutting tiles…" : sidecar.tiles ? "Re-cut tiles" : "Cut tiles"}
                        </button>
                        {sidecar.tiles && (
                          <a
                            href={archiveUrl(job.job_id)}
                            className="rounded-lg border border-accent-teal/40 bg-accent-teal/10 px-3 py-1.5 text-xs font-medium text-accent-teal hover:bg-accent-teal/20"
                          >
                            Download {sidecar.tiles.archive.path} ({sidecar.tiles.n_tiles} tiles, z{sidecar.tiles.min_zoom}–z
                            {sidecar.tiles.max_zoom})
                          </a>
                        )}
                        {tilesError && <span className="text-xs text-accent-red">{tilesError}</span>}
                      </div>
                    </section>
                  </>
                )}
                {!loading && !error && !job && jobs.length > 0 && (
                  <p className="py-12 text-center text-sm text-muted">Select a job.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <SiteFooter
        poweredBy={
          <a href="https://github.com/smk762/argus-atlas" className="text-accent-teal hover:underline">
            argus-atlas
          </a>
        }
        right={<>GDAL controls · ComfyUI bake · PMTiles</>}
      />
    </div>
  );
}
