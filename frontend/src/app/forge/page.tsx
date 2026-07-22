"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ApiVersionBadge } from "@/components/ApiVersionBadge";
import { CapabilityNotice } from "@/components/CapabilityNotice";
import {
  allowsTraining,
  forgeConfig,
  getForgeHealth,
  inspectExport,
  listTrainers,
  TRAINER_LABELS,
  type ForgeDatasetInfo,
  type ForgeHealth,
  type ForgeResult,
  type TrainerId,
  type TrainerInfo,
} from "@/lib/forgeApi";
import { capabilityReason, permits, type Capability } from "@/lib/capabilities";
import { isLive, localOutputPath } from "@/lib/curatorEnv";
import { downloadText } from "@/lib/download";
import { basename, normalizeRoot } from "@/lib/path";
import {
  CATEGORY_LABELS,
  TARGET_CATEGORIES,
  datasetSizeStatus,
  suggestTrainingParams,
  type DatasetSizeTone,
  type TargetCategory,
} from "@/components/curator/types";
import { demoKohyaFiles, forgeSlug } from "@/components/curator/forgeDemo";

/** Trainers to offer before `/trainers` answers (and the whole list in demo mode). */
const FALLBACK_TRAINERS: TrainerInfo[] = (Object.keys(TRAINER_LABELS) as TrainerId[]).map((id) => ({
  id,
  label: TRAINER_LABELS[id],
  files: [],
  notes: "",
  entrypoint: null,
}));

const TONE_CLASS: Record<DatasetSizeTone, string> = {
  empty: "border-accent-red/30 bg-accent-red/5 text-accent-red",
  low: "border-accent-orange/30 bg-accent-orange/5 text-accent-orange",
  good: "border-accent-green/30 bg-accent-green/5 text-accent-green",
  high: "border-accent-orange/30 bg-accent-orange/5 text-accent-orange",
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent-amber/50 focus:outline-none focus:ring-1 focus:ring-accent-amber/50 disabled:cursor-not-allowed disabled:opacity-50";

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

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
 * Forge's own suggested params. Tolerant of a payload that omits `suggested`:
 * every field here comes from an unvalidated `resp.json()`, and a missing block
 * would otherwise throw from inside this component and blank the route.
 */
function ParamsGrid({ params }: { params: ForgeDatasetInfo["suggested"] | undefined }) {
  if (!params) return null;
  const rows: [string, string | number][] = [
    ["repeats", params.repeats],
    ["epochs", params.epochs],
    ["total steps", params.total_steps],
    ["optimizer steps", params.optimizer_steps],
    ["network dim", params.network_dim],
    ["network alpha", params.network_alpha],
    ["unet lr", params.unet_lr],
    ["text encoder lr", params.text_encoder_lr],
    ["optimizer", params.optimizer],
    ["scheduler", params.scheduler],
    ["resolution", params.resolution],
    ["batch size", params.batch_size],
    ["precision", params.precision],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {rows.map(([k, v]) => (
        <Stat key={k} label={k} value={v ?? "—"} />
      ))}
    </div>
  );
}

/** The selected trainer's notes and file list, when the server supplied them. */
function TrainerNotes({ trainers, trainer }: { trainers: TrainerInfo[]; trainer: TrainerId }) {
  const t = trainers.find((x) => x.id === trainer);
  if (!t) return null;
  const files = t.files ?? [];
  return (
    <>
      {t.notes && <p className="text-xs leading-relaxed text-muted">{t.notes}</p>}
      {files.length > 0 && (
        <p className="text-xs text-muted">
          Writes <span className="font-mono text-foreground/80">{files.join(", ")}</span>
          {t.entrypoint && (
            <>
              {" "}
              · run <span className="font-mono text-foreground/80">{t.entrypoint}</span>
            </>
          )}
        </p>
      )}
    </>
  );
}

export default function ForgePage() {
  // Resolved once per render: isLive() reads the per-request runtime config, and
  // the fallback path when the injected global is missing rebuilds the whole
  // config on every call.
  const live = isLive();

  // version: null = loading, "" = unreachable, or a real version. Demo mode has
  // no server to version, and renders its own Demo pill instead of the badge —
  // so no page-specific sentinel is fed to ApiVersionBadge, which documents that
  // it renders only real/""/null.
  const [version, setVersion] = useState<string | null>(null);
  const [health, setHealth] = useState<ForgeHealth | null>(null);
  const [trainers, setTrainers] = useState<TrainerInfo[]>(FALLBACK_TRAINERS);
  const [trainersEmpty, setTrainersEmpty] = useState(false);

  const [exportDir, setExportDir] = useState("");
  // null = "use whatever the manifest says". Sending a category makes forge
  // OVERRIDE the manifest's own target_category (argus_forge/manifest.py), so a
  // hardcoded default would silently re-tune a config for the wrong LoRA type.
  const [category, setCategory] = useState<TargetCategory | null>(null);
  const [trainer, setTrainer] = useState<TrainerId>("kohya");
  const [trigger, setTrigger] = useState("");
  const [baseModel, setBaseModel] = useState("");
  // Off by default: a config run writes into <export>/forge/<trainer>/, and a
  // public demo shouldn't accumulate files from every passing visitor.
  const [writeToDisk, setWriteToDisk] = useState(false);

  // Each result is stored with the inputs that produced it, so a panel can never
  // describe an export the form no longer names.
  const [dataset, setDataset] = useState<{ key: string; info: ForgeDatasetInfo } | null>(null);
  const [result, setResult] = useState<{ key: string; res: ForgeResult } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo mode: images to size the client-side estimate against. Held as text so
  // the field can be cleared while typing instead of snapping to 0.
  const [demoCountText, setDemoCountText] = useState("40");

  // Only meaningful in live mode: demo never probes, so it is not "unreachable".
  const unreachable = live && version === "";
  const trainingCap: Capability = live && !unreachable ? allowsTraining(health) : false;
  const canWrite = permits(trainingCap);
  // The effective request flag: a host that won't train won't write either, and
  // forge would force dry_run server-side anyway.
  const willWrite = writeToDisk && canWrite;

  // Forge's own root, not the curator's: forge fences every request under it and
  // refuses the root itself, so this drives the placeholder and the guard below.
  const exportRoot = normalizeRoot(health?.export_root || localOutputPath() || "/data/out");
  const dirTrimmed = exportDir.trim();
  const atRoot = dirTrimmed !== "" && normalizeRoot(dirTrimmed) === exportRoot;

  const inspectKey = JSON.stringify({ dir: dirTrimmed, category });
  const configKey = JSON.stringify({ dir: dirTrimmed, category, trainer, willWrite });
  const shownDataset = dataset?.key === inspectKey ? dataset.info : null;
  const shownResult = result?.key === configKey ? result.res : null;

  // Reachability, capability, and the authoritative trainer list.
  useEffect(() => {
    if (!live) return;
    const ctrl = new AbortController();
    (async () => {
      // allSettled: an old forge without /trainers mustn't blank the version pill.
      const [h, t] = await Promise.allSettled([
        getForgeHealth(ctrl.signal),
        listTrainers(ctrl.signal),
      ]);
      if (ctrl.signal.aborted) return;
      if (h.status === "fulfilled") {
        setVersion(h.value.version);
        setHealth(h.value);
      } else {
        setVersion("");
      }
      if (t.status === "fulfilled") {
        // An empty list is an answer, not a miss: keeping the hardcoded three
        // would offer trainers this build cannot emit. Reconcile the selection
        // so it is always a member of the list actually on screen.
        setTrainersEmpty(t.value.length === 0);
        if (t.value.length > 0) {
          setTrainers(t.value);
          setTrainer((cur) => (t.value.some((x) => x.id === cur) ? cur : t.value[0].id));
        }
      }
    })();
    return () => ctrl.abort();
  }, [live]);

  // Deep link from a completed export (#67): /forge?export=<dir>.
  useEffect(() => {
    const dir = new URLSearchParams(window.location.search).get("export");
    if (dir) setExportDir(dir);
  }, []);

  // One in-flight request at a time; a superseded or unmounted one is aborted so
  // its response can never land over inputs the user has since changed.
  const reqCtrl = useRef<AbortController | null>(null);
  useEffect(() => () => reqCtrl.current?.abort(), []);

  const run = useCallback(
    async <T,>(call: (signal: AbortSignal) => Promise<T>, label: string, onOk: (v: T) => void) => {
      reqCtrl.current?.abort();
      const ctrl = new AbortController();
      reqCtrl.current = ctrl;
      setBusy(true);
      setError(null);
      try {
        const value = await call(ctrl.signal);
        if (ctrl.signal.aborted) return;
        onOk(value);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setError(`${label} failed: ${errMsg(err)}`);
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
        if (reqCtrl.current === ctrl) reqCtrl.current = null;
      }
    },
    [],
  );

  const inspect = useCallback(() => {
    const key = inspectKey;
    return run(
      (signal) => inspectExport({ export_dir: dirTrimmed, category }, signal),
      "Inspect",
      (info) => {
        setDataset({ key, info });
        setResult(null);
      },
    );
  }, [run, inspectKey, dirTrimmed, category]);

  const generate = useCallback(() => {
    const key = configKey;
    const dKey = inspectKey;
    return run(
      (signal) =>
        forgeConfig(
          {
            export_dir: dirTrimmed,
            trainer,
            category,
            trigger: trigger.trim() || null,
            base_model: baseModel.trim() || null,
            dry_run: !willWrite,
          },
          signal,
        ),
      "Config",
      (forged) => {
        setResult({ key, res: forged });
        if (forged.dataset) setDataset({ key: dKey, info: forged.dataset });
      },
    );
  }, [run, configKey, inspectKey, dirTrimmed, trainer, category, trigger, baseModel, willWrite]);

  // Demo mode has no backend, so the same heuristics run client-side — the kohya
  // pair only, which is what forgeDemo covers. Built only when it can be shown.
  const demoCount = Math.max(0, Math.floor(Number(demoCountText)) || 0);
  const demoCategory = category ?? "identity";
  const demoFiles = useMemo(
    () => (live ? [] : demoKohyaFiles(demoCount, demoCategory, trigger.trim() || "subject")),
    [live, demoCount, demoCategory, trigger],
  );
  const demoSize = useMemo(
    () => (live ? null : datasetSizeStatus(demoCount, demoCategory)),
    [live, demoCount, demoCategory],
  );
  const demoParams = useMemo(
    () => (live ? null : suggestTrainingParams(demoCount, demoCategory)),
    [live, demoCount, demoCategory],
  );

  const files: { name: string; content: string }[] = live ? (shownResult?.files ?? []) : demoFiles;
  const warnings = shownResult?.warnings ?? [];
  const actionsBlocked = busy || unreachable || !dirTrimmed || atRoot;

  const trainingNote = !live
    ? "Demo mode builds configs in your browser — there is no server here to run training on."
    : unreachable
      ? "Can't tell whether this host trains: argus-forge is unreachable."
      : capabilityReason(
          trainingCap,
          "Training is disabled on this host — it needs a GPU. Configs still render here, ready to run wherever you have one.",
        );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        active="/forge"
        logo={{ letter: "F", tone: "amber" }}
        title="Argus Forge"
        subtitle="Turn a curated export into a ready-to-run LoRA training config"
        badge={
          live ? (
            <ApiVersionBadge label="argus-forge" version={version} prefix="v" />
          ) : (
            <div className="shrink-0 text-right">
              <span className="rounded-md border border-accent-amber/40 bg-accent-amber/10 px-2 py-1 text-[10px] uppercase tracking-wider text-accent-amber">
                Demo
              </span>
            </div>
          )
        }
      />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        {unreachable && (
          <CapabilityNotice
            reason={
              <>
                argus-forge is unreachable. Start it with the <span className="font-mono">forge</span> compose
                profile, or set <span className="font-mono">ARGUS_FORGE_URL</span> to where it is running.
              </>
            }
          />
        )}

        {!live && (
          <CapabilityNotice
            reason={
              <>
                Demo mode: configs are built in your browser from the same sizing heuristics, for kohya only.
                Set <span className="font-mono">ARGUS_CURATOR_UI_MODE=live</span> and run argus-forge to inspect a
                real export and emit all three trainers.
              </>
            }
          />
        )}

        {trainersEmpty && (
          <CapabilityNotice reason="This argus-forge build advertises no trainers, so it cannot emit a config." />
        )}

        {/* ── Source ─────────────────────────────────────────────── */}
        <section className="space-y-4 rounded-xl border border-border bg-surface/50 p-5">
          <h2 className="text-sm font-medium text-foreground">Export</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {live ? (
              <div className="sm:col-span-2">
                <Field label="Export directory (as forge sees it)">
                  <input
                    value={exportDir}
                    onChange={(e) => setExportDir(e.target.value)}
                    disabled={busy}
                    placeholder={`${exportRoot}/my-subject`}
                    className={inputClass}
                  />
                </Field>
                <p className="mt-1 text-[11px] text-muted">
                  A folder <em>under</em> forge&apos;s export root{" "}
                  <span className="font-mono text-foreground/80">{exportRoot}</span> — one export, not the root
                  itself.
                </p>
              </div>
            ) : (
              <Field label="Images (estimate)">
                <input
                  value={demoCountText}
                  onChange={(e) => setDemoCountText(e.target.value)}
                  inputMode="numeric"
                  className={inputClass}
                />
              </Field>
            )}
            <Field label="Category">
              <select
                value={category ?? ""}
                onChange={(e) => setCategory((e.target.value || null) as TargetCategory | null)}
                disabled={busy}
                className={inputClass}
              >
                {/* Default: let the manifest speak. Sending a value overrides the
                    curator's own target_category on forge's side. */}
                <option value="">From the manifest</option>
                {TARGET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Trigger word">
              <input
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                disabled={busy}
                // What forge would actually derive, not the raw folder name — it
                // slugifies, so "Jane Doe" becomes "jane_doe".
                placeholder={forgeSlug(basename(dirTrimmed) || "subject")}
                className={inputClass}
              />
            </Field>
          </div>
          {atRoot && (
            <CapabilityNotice
              reason={
                <>
                  That is forge&apos;s export root itself. Name one export under it (e.g.{" "}
                  <span className="font-mono">{exportRoot}/my-subject</span>) — forge refuses the root, since
                  treating the whole shared volume as one dataset would merge every export.
                </>
              }
            />
          )}
          {live && (
            <button
              type="button"
              onClick={() => void inspect()}
              disabled={actionsBlocked}
              className="cursor-pointer rounded-lg border border-border bg-background px-4 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Working…" : "Inspect"}
            </button>
          )}
        </section>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-accent-red/30 bg-accent-red/5 px-3 py-2 text-sm text-accent-red"
          >
            {error}
          </p>
        )}

        {/* ── What forge found ───────────────────────────────────── */}
        {shownDataset && (
          <section className="space-y-4 rounded-xl border border-border bg-surface/50 p-5">
            <h2 className="text-sm font-medium text-foreground">Dataset</h2>
            {shownDataset.size_hint && (
              <p
                className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${
                  TONE_CLASS[shownDataset.size_hint.tone] ?? "border-border bg-background/60 text-muted"
                }`}
              >
                {shownDataset.size_hint.text}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="images" value={shownDataset.image_count ?? "—"} />
              <Stat label="captions" value={shownDataset.caption_count ?? "—"} />
              <Stat label="manifest rows" value={shownDataset.manifest_present ? shownDataset.manifest_rows : "—"} />
              <Stat label="manifest version" value={shownDataset.manifest_version ?? "—"} />
              <Stat label="missing from disk" value={shownDataset.missing_from_disk ?? "—"} />
            </div>
            {/* The category forge actually used — it overrides the manifest when
                one is sent, so show the effective value rather than the input. */}
            <p className="text-[11px] text-muted">
              Sized for{" "}
              <span className="font-mono text-foreground/80">
                {shownDataset.target_profile?.target_category
                  ? CATEGORY_LABELS[shownDataset.target_profile.target_category]
                  : "—"}
              </span>
              {category === null ? " (from the manifest)" : " (overridden here)"}
            </p>
            <h3 className="text-[11px] uppercase tracking-wide text-muted">Suggested parameters</h3>
            <ParamsGrid params={shownDataset.suggested} />
          </section>
        )}

        {/* Demo mode has no export to inspect, so the same client-side heuristics
            stand in for it — the sizing advice is the point of the page. */}
        {!live && demoSize && demoParams && (
          <section className="space-y-4 rounded-xl border border-border bg-surface/50 p-5">
            <h2 className="text-sm font-medium text-foreground">Dataset (estimate)</h2>
            <p className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${TONE_CLASS[demoSize.tone]}`}>
              {demoSize.text}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="images" value={demoParams.images} />
              <Stat label="repeats" value={demoParams.repeats} />
              <Stat label="epochs" value={demoParams.epochs} />
              <Stat label="total steps" value={demoParams.totalSteps} />
              <Stat label="batch size" value={demoParams.batchSize} />
            </div>
          </section>
        )}

        {/* ── Trainer + config ───────────────────────────────────── */}
        <section className="space-y-4 rounded-xl border border-border bg-surface/50 p-5">
          <h2 id="trainer-label" className="text-sm font-medium text-foreground">
            Trainer
          </h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="trainer-label">
            {trainers.map((t) => {
              const demoOnly = !live && t.id !== "kohya";
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={trainer === t.id}
                  onClick={() => setTrainer(t.id)}
                  disabled={demoOnly || busy}
                  title={demoOnly ? "Demo mode builds kohya configs only." : t.notes || undefined}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    trainer === t.id
                      ? "border border-accent-amber/40 bg-accent-amber/20 text-accent-amber"
                      : "border border-border bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {/* The disabled chips' `title` is unreachable by keyboard, so say it in
              text too rather than leaving them looking broken. */}
          {!live && <p className="text-[11px] text-muted">Demo mode builds kohya configs only.</p>}

          <TrainerNotes trainers={trainers} trainer={trainer} />

          {live && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Base model (optional)">
                <input
                  value={baseModel}
                  onChange={(e) => setBaseModel(e.target.value)}
                  disabled={busy}
                  placeholder="stabilityai/stable-diffusion-xl-base-1.0"
                  className={inputClass}
                />
              </Field>
              <label className="flex cursor-pointer items-end gap-2 pb-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={willWrite}
                  onChange={(e) => setWriteToDisk(e.target.checked)}
                  disabled={busy || !canWrite}
                  className="h-4 w-4 cursor-pointer accent-accent-amber disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span>
                  Write files into the export
                  <span className="block text-[11px] text-muted">
                    Off: preview only, nothing touches the export dir.
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Without this the checkbox would offer a write the server has already
              decided to refuse — forge forces dry_run on a demo-safe host and
              still answers 200, so the refusal would surface only as a warning
              after the user committed. */}
          {live && !unreachable && !canWrite && (
            <CapabilityNotice
              reason={
                trainingCap === false
                  ? "This argus-forge has training disabled, so it renders configs without writing them. Preview works; writing into the export does not."
                  : "Checking whether this argus-forge will write into the export…"
              }
            />
          )}

          {live && (
            <button
              type="button"
              onClick={() => void generate()}
              disabled={actionsBlocked || trainersEmpty}
              className="cursor-pointer rounded-lg bg-accent-amber px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Working…" : willWrite ? "Generate + write" : "Preview config"}
            </button>
          )}
        </section>

        {/* ── Generated files ────────────────────────────────────── */}
        {files.length > 0 && (
          <section className="space-y-4 rounded-xl border border-border bg-surface/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-foreground">
                {live && willWrite ? "Config" : "Config preview"}
                {shownResult && <span className="ml-2 font-mono text-xs text-muted">{shownResult.trainer}</span>}
              </h2>
              {/* Only a run that actually wrote has a location worth quoting; on a
                  preview nothing is at out_dir. */}
              {shownResult?.out_dir && willWrite && (
                <span className="font-mono text-xs text-muted">{shownResult.out_dir}</span>
              )}
            </div>

            {warnings.map((w, i) => (
              // Index-keyed: forge appends warnings from several sites and two can
              // legitimately be identical, which a text key would collapse.
              <CapabilityNotice key={`${i}-${w}`} reason={w} />
            ))}

            {files.map((f) => (
              <div key={f.name} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-foreground/80">{f.name}</span>
                  <button
                    type="button"
                    // forge names a file by its path within the export
                    // (`forge/kohya/config.toml`); a download wants just the leaf.
                    onClick={() =>
                      downloadText(basename(f.name) || "config.txt", f.content, "text/plain;charset=utf-8")
                    }
                    className="cursor-pointer rounded-lg border border-border px-3 py-1 text-xs text-muted transition-colors hover:text-foreground"
                  >
                    Download
                  </button>
                </div>
                <pre
                  tabIndex={0}
                  role="region"
                  aria-label={f.name}
                  className="max-h-96 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground/90 focus:outline-none focus:ring-1 focus:ring-accent-amber/50"
                >
                  {f.content}
                </pre>
              </div>
            ))}
          </section>
        )}

        {/* ── Training ───────────────────────────────────────────── */}
        <section className="space-y-3 rounded-xl border border-border bg-surface/50 p-5">
          <h2 className="text-sm font-medium text-foreground">Training</h2>
          {trainingNote ? (
            <CapabilityNotice reason={trainingNote} />
          ) : (
            <p className="text-xs leading-relaxed text-muted">
              This host will run training. Launching and monitoring runs from here is not wired up yet — see
              issue #63.
            </p>
          )}
        </section>
      </main>

      <SiteFooter
        poweredBy={
          <>
            <a
              href="https://github.com/smk762/argus-forge"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-amber transition-colors hover:text-accent-amber/80"
            >
              argus-forge
            </a>{" "}
            · training bridge
          </>
        }
        right="Configs are generated locally; nothing is uploaded."
      />
    </div>
  );
}
