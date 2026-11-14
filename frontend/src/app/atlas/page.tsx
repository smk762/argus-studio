"use client";

import { useCallback, useEffect, useState } from "react";
import {
  allowsBake,
  allowsGdal,
  allowsOsm,
  getAtlasHealth,
  getInputs,
  getJob,
  listJobs,
  listPresets,
  type AtlasHealth,
  type AtlasInputs,
  type AtlasJob,
  type AtlasPreset,
  type JobDigest,
  REALMS_URL,
} from "@/lib/atlasApi";
import { STATIC_DEMO } from "@/lib/staticDemo";
import { AtlasDataCredits, DemoBadge, RecordedDemoNote } from "@/components/DemoChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ApiVersionBadge } from "@/components/ApiVersionBadge";
import { NewCanvas } from "@/components/atlas/NewCanvas";
import { JobView, STATUS_DOT } from "@/components/atlas/JobView";
import { JobBadges } from "@/components/atlas/JobBadges";
import { DoctorPanel } from "@/components/atlas/DoctorPanel";
import { ExternalLink } from "@/components/ExternalLink";

export default function AtlasPage() {
  // version: null = loading, "" = unreachable, else the server version.
  const [version, setVersion] = useState<string | null>(null);
  // Drives the bake affordance (#66): only a settled read_only=false arms it.
  const [health, setHealth] = useState<AtlasHealth | null>(null);
  const [jobs, setJobs] = useState<JobDigest[]>([]);
  const [presets, setPresets] = useState<AtlasPreset[]>([]);
  const [inputs, setInputs] = useState<AtlasInputs | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [job, setJob] = useState<AtlasJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unreachable = version === "";

  // Reachability + the listings. allSettled so one broken listing can't hide a
  // healthy server behind "not running" or drop the capability probe.
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      if (STATIC_DEMO) {
        // Recorded jobs: no server to probe, just the bundled list.
        const list = await listJobs(ctrl.signal).catch(() => []);
        if (ctrl.signal.aborted) return;
        setVersion("recorded");
        setJobs(list);
        if (list.length > 0) setSelected(list[0].job_id);
        return;
      }
      const [h, list, p, inp] = await Promise.allSettled([
        getAtlasHealth(ctrl.signal),
        listJobs(ctrl.signal),
        listPresets(ctrl.signal),
        getInputs(ctrl.signal),
      ]);
      if (ctrl.signal.aborted) return;
      if (h.status === "fulfilled") {
        setVersion(h.value.version);
        setHealth(h.value);
      } else {
        setVersion("");
      }
      if (list.status === "fulfilled") {
        setJobs(list.value);
        if (list.value.length > 0) setSelected(list.value[0].job_id);
      }
      if (p.status === "fulfilled") setPresets(p.value);
      if (inp.status === "fulfilled") setInputs(inp.value);
    })();
    return () => ctrl.abort();
  }, []);

  const loadJob = useCallback(async (jobId: string, signal?: AbortSignal) => {
    try {
      const loaded = await getJob(jobId, signal);
      setJob(loaded);
      setError(null);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to load job");
      setJob(null);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    const ctrl = new AbortController();
    (async () => {
      await loadJob(selected, ctrl.signal);
    })();
    return () => ctrl.abort();
  }, [selected, loadJob]);

  // After controls, a bake or tiles: refresh the list (status dots) and the job.
  const refresh = useCallback(
    async (jobId: string) => {
      try {
        setJobs(await listJobs());
      } catch {
        // best-effort; the job itself still reloads below
      }
      if (jobId === selected) await loadJob(jobId);
      else setSelected(jobId);
    },
    [selected, loadJob],
  );

  // After POST /osm: the new extract is only named by /inputs.
  const reloadInputs = useCallback(async () => {
    setInputs(await getInputs());
  }, []);

  const canBake = allowsBake(health);
  const canGdal = allowsGdal(health);
  const canOsm = allowsOsm(health);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        active="/atlas"
        logo={{ letter: "A" }}
        title="Argus Atlas"
        subtitle="Georeferenced fantasy maps from real terrain"
        badge={STATIC_DEMO ? <DemoBadge state="recorded" /> : <ApiVersionBadge label="argus-atlas" version={version} prefix="v" />}
      />

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {unreachable ? (
          <div className="mx-auto max-w-xl space-y-4 py-24 text-center">
            <h2 className="text-lg font-medium text-foreground/70">The argus-atlas server is not running.</h2>
            <p className="text-sm text-muted">
              Start it with{" "}
              <code className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-xs">argus-atlas serve --cors</code> on{" "}
              <span className="font-mono">:8105</span> (<span className="font-mono">pip install &quot;argus-atlas[server,cli,tiles]&quot;</span>,
              GDAL required), or run the <span className="font-mono">atlas</span> compose profile.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {health && health.gdal === null && (
              <p className="rounded-lg border border-accent-red/30 bg-accent-red/5 px-3 py-2 text-xs text-accent-red-ink">
                GDAL is missing on the atlas host, so it cannot build controls or tiles. Use the Docker image, which ships GDAL 3.11.
              </p>
            )}
            {STATIC_DEMO ? (
              <RecordedDemoNote summary={<>{ATLAS_DEMO_SUMMARY}</>}>
                <AtlasDemoProvenance />
              </RecordedDemoNote>
            ) : (
              <>
                <DoctorPanel />
                <NewCanvas
                  inputs={inputs}
                  canGdal={canGdal}
                  canOsm={canOsm}
                  onCreated={(id) => void refresh(id)}
                  onInputsChanged={reloadInputs}
                />
              </>
            )}
            {/* minmax(0, …) tracks: an `auto` track grows to its min-content, and a long
                canvas name (one nowrap line, even when truncated) pushed it past the viewport. */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
              {/* Scrolls on its own beside the job view: a working host holds dozens of canvases. */}
              <aside className="space-y-1 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
                <div className="mb-2 text-[10px] uppercase tracking-wide text-muted">Canvases</div>
                {jobs.length === 0 && version !== null && (
                  <p className="text-sm text-muted">
                    {STATIC_DEMO ? (
                      <>
                        No recorded jobs in this build. The full map is on{" "}
                        <ExternalLink href={REALMS_URL} className="text-accent-teal-ink hover:underline">
                          realms.dragonhound.dev
                        </ExternalLink>
                        .
                      </>
                    ) : (
                      "No jobs yet."
                    )}
                  </p>
                )}
                {jobs.map((j) => (
                  <button
                    key={j.job_id}
                    type="button"
                    onClick={() => setSelected(j.job_id)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                      selected === j.job_id ? "border-accent-blue/60 bg-surface" : "border-border bg-surface/40 hover:bg-surface-hover"
                    }`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[j.status]}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs text-foreground">{j.job_id}</span>
                      <span className="block text-[10px] text-muted">
                        {j.width}×{j.height} · {j.resolution.toFixed(0)} m/px · z{j.native_zoom}
                        {j.layers.length > 0 ? ` · ${j.layers.length} layers` : ""}
                      </span>
                      <JobBadges chunk={j.chunk} recipe={j.recipe} className="mt-1" />
                    </span>
                  </button>
                ))}
              </aside>

              <div>
                {error && <p className="py-12 text-center text-sm text-accent-red-ink">{error}</p>}
                {!error && job && (
                  <JobView
                    key={job.job_id}
                    job={job}
                    presets={presets}
                    canBake={canBake}
                    canGdal={canGdal}
                    onChanged={() => void refresh(job.job_id)}
                  />
                )}
                {!error && !job && jobs.length > 0 && (
                  <p className="py-12 text-center text-sm text-muted">Select a canvas.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <SiteFooter
        poweredBy={
          <ExternalLink
            href="https://github.com/smk762/argus-atlas"
            className="text-accent-blue-ink transition-colors hover:text-accent-blue-ink"
          >
            argus-atlas
          </ExternalLink>
        }
        right={<AtlasDataCredits />}
      />
    </div>
  );
}

/** One line under the title; the rest folds into "Details". */
const ATLAS_DEMO_SUMMARY = "Real argus-atlas jobs, replayed from their recorded output.";

/** Where the recorded atlas jobs came from. Data credits live in the footer. */
function AtlasDemoProvenance() {
  return (
    <>
      Seven real jobs from the argus-atlas 0.3.0 island bake behind{" "}
      <ExternalLink href={REALMS_URL} className="underline hover:text-foreground">
        realms.dragonhound.dev
      </ExternalLink>
      , one chunk in each of its seven styles: antique, imhof, watercolor and pixel over Iceland (z7), tolkien,
      cyberpunk and minecraft over Réunion (z11). Each records 0.3&apos;s relief correction: hillshade and slope
      take a height factor from the chunk&apos;s latitude, about 2.2 to 2.5 in Iceland and 1.07 in Réunion, with
      no added exaggeration. The antique chunk also carries its OSM place names. Sidecars are as the server
      returned them, with host paths made relative; previews are re-encoded to WebP; the PMTiles archives are
      not bundled, and the whole map is live on realms. Building controls and baking need a running argus-atlas
      (and a GPU for the bake).
    </>
  );
}
