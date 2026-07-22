"use client";

import { useCallback, useEffect, useState } from "react";
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
import { capabilityReason } from "@/lib/capabilities";
import { isLive, localOutputPath } from "@/lib/curatorEnv";
import { downloadText } from "@/lib/download";
import { basename } from "@/lib/path";
import {
  CATEGORY_LABELS,
  TARGET_CATEGORIES,
  type TargetCategory,
} from "@/components/curator/types";
import { buildKohyaConfigToml, buildKohyaDatasetToml } from "@/components/curator/forgeDemo";

/** Trainers to offer before `/trainers` answers (and the whole list in demo mode). */
const FALLBACK_TRAINERS: TrainerInfo[] = (Object.keys(TRAINER_LABELS) as TrainerId[]).map((id) => ({
  id,
  label: TRAINER_LABELS[id],
  files: [],
  notes: "",
  entrypoint: null,
}));

const TONE_CLASS: Record<ForgeDatasetInfo["size_hint"]["tone"], string> = {
  empty: "border-accent-red/30 bg-accent-red/5 text-accent-red",
  low: "border-accent-orange/30 bg-accent-orange/5 text-accent-orange",
  good: "border-accent-green/30 bg-accent-green/5 text-accent-green",
  high: "border-accent-orange/30 bg-accent-orange/5 text-accent-orange",
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent-amber/50 focus:outline-none focus:ring-1 focus:ring-accent-amber/50";

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

/** The suggested-params grid, shown for both a live inspect and the demo estimate. */
function ParamsGrid({ params }: { params: ForgeDatasetInfo["suggested"] }) {
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
        <Stat key={k} label={k} value={v} />
      ))}
    </div>
  );
}

export default function ForgePage() {
  // version: null = loading, "" = unreachable, "demo", or a real version.
  const [version, setVersion] = useState<string | null>(isLive() ? null : "demo");
  const [health, setHealth] = useState<ForgeHealth | null>(null);
  const [trainers, setTrainers] = useState<TrainerInfo[]>(FALLBACK_TRAINERS);

  const [exportDir, setExportDir] = useState(localOutputPath() || "/data/out");
  const [category, setCategory] = useState<TargetCategory>("identity");
  const [trainer, setTrainer] = useState<TrainerId>("kohya");
  const [trigger, setTrigger] = useState("");
  const [baseModel, setBaseModel] = useState("");
  // Off by default: a config run writes into <export>/forge/<trainer>/, and a
  // public demo shouldn't accumulate files from every passing visitor. Preview
  // (dry_run) answers the "what would this produce?" question the page is for.
  const [writeToDisk, setWriteToDisk] = useState(false);

  const [dataset, setDataset] = useState<ForgeDatasetInfo | null>(null);
  const [result, setResult] = useState<ForgeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo mode: images to size the client-side estimate against, since there is
  // no export on disk to inspect.
  const [demoCount, setDemoCount] = useState(40);

  const trainingReason = capabilityReason(
    allowsTraining(health),
    "Training is disabled on this host — it needs a GPU. Configs still render here, ready to run wherever you have one.",
  );

  // Reachability, capability, and the authoritative trainer list.
  useEffect(() => {
    if (!isLive()) return;
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
      if (t.status === "fulfilled" && t.value.length > 0) setTrainers(t.value);
    })();
    return () => ctrl.abort();
  }, []);

  // Deep link from a completed export (#67): /forge?export=<dir>.
  useEffect(() => {
    const dir = new URLSearchParams(window.location.search).get("export");
    if (dir) setExportDir(dir);
  }, []);

  const selectedTrainer = trainers.find((t) => t.id === trainer) ?? null;

  const inspect = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setDataset(await inspectExport({ export_dir: exportDir.trim(), category }));
    } catch (err) {
      setDataset(null);
      setError(`Inspect failed: ${errMsg(err)}`);
    } finally {
      setBusy(false);
    }
  }, [exportDir, category]);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const forged = await forgeConfig({
        export_dir: exportDir.trim(),
        trainer,
        category,
        trigger: trigger.trim() || null,
        base_model: baseModel.trim() || null,
        dry_run: !writeToDisk,
      });
      setResult(forged);
      setDataset(forged.dataset);
    } catch (err) {
      setResult(null);
      setError(`Config failed: ${errMsg(err)}`);
    } finally {
      setBusy(false);
    }
  }, [exportDir, trainer, category, trigger, baseModel, writeToDisk]);

  // Demo mode has no backend, so the same heuristics run client-side — the
  // kohya pair only, which is what forgeDemo covers.
  const demoFiles = [
    { name: "dataset.toml", content: buildKohyaDatasetToml(demoCount, category, trigger.trim() || "subject") },
    { name: "config.toml", content: buildKohyaConfigToml(demoCount, category, trigger.trim() || "subject") },
  ];

  const files = isLive() ? (result?.files ?? []) : demoFiles;
  const unreachable = version === "";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        active="/forge"
        logo={{ letter: "F", tone: "amber" }}
        title="Argus Forge"
        subtitle="Turn a curated export into a ready-to-run LoRA training config"
        badge={<ApiVersionBadge label="argus-forge" version={version} prefix="v" />}
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

        {!isLive() && (
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

        {/* ── Source ─────────────────────────────────────────────── */}
        <section className="space-y-4 rounded-xl border border-border bg-surface/50 p-5">
          <h2 className="text-sm font-medium text-foreground">Export</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {isLive() ? (
              <div className="sm:col-span-2">
                <Field label="Export directory (as forge sees it)">
                  <input
                    value={exportDir}
                    onChange={(e) => setExportDir(e.target.value)}
                    placeholder="/data/out/my-subject"
                    className={inputClass}
                  />
                </Field>
              </div>
            ) : (
              <Field label="Images (estimate)">
                <input
                  value={demoCount}
                  onChange={(e) => setDemoCount(Math.max(0, Number(e.target.value) || 0))}
                  inputMode="numeric"
                  className={inputClass}
                />
              </Field>
            )}
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TargetCategory)}
                className={inputClass}
              >
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
                placeholder={basename(exportDir) || "subject"}
                className={inputClass}
              />
            </Field>
          </div>
          {isLive() && (
            <button
              type="button"
              onClick={inspect}
              disabled={busy || !exportDir.trim()}
              className="cursor-pointer rounded-lg border border-border bg-background px-4 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Working…" : "Inspect"}
            </button>
          )}
        </section>

        {error && (
          <p className="rounded-lg border border-accent-red/30 bg-accent-red/5 px-3 py-2 text-sm text-accent-red">
            {error}
          </p>
        )}

        {/* ── What forge found ───────────────────────────────────── */}
        {dataset && (
          <section className="space-y-4 rounded-xl border border-border bg-surface/50 p-5">
            <h2 className="text-sm font-medium text-foreground">Dataset</h2>
            <p className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${TONE_CLASS[dataset.size_hint.tone]}`}>
              {dataset.size_hint.text}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="images" value={dataset.image_count} />
              <Stat label="captions" value={dataset.caption_count} />
              <Stat label="manifest rows" value={dataset.manifest_present ? dataset.manifest_rows : "—"} />
              <Stat label="manifest version" value={dataset.manifest_version ?? "—"} />
              <Stat label="missing from disk" value={dataset.missing_from_disk} />
            </div>
            <h3 className="text-[11px] uppercase tracking-wide text-muted">Suggested parameters</h3>
            <ParamsGrid params={dataset.suggested} />
          </section>
        )}

        {/* ── Trainer + config ───────────────────────────────────── */}
        <section className="space-y-4 rounded-xl border border-border bg-surface/50 p-5">
          <h2 className="text-sm font-medium text-foreground">Trainer</h2>
          <div className="flex flex-wrap gap-2">
            {trainers.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTrainer(t.id)}
                disabled={!isLive() && t.id !== "kohya"}
                title={!isLive() && t.id !== "kohya" ? "Demo mode builds kohya configs only." : t.notes || undefined}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  trainer === t.id
                    ? "border border-accent-amber/40 bg-accent-amber/20 text-accent-amber"
                    : "border border-border bg-background text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {selectedTrainer?.notes && <p className="text-xs leading-relaxed text-muted">{selectedTrainer.notes}</p>}
          {selectedTrainer && selectedTrainer.files.length > 0 && (
            <p className="text-xs text-muted">
              Writes <span className="font-mono text-foreground/80">{selectedTrainer.files.join(", ")}</span>
              {selectedTrainer.entrypoint && (
                <>
                  {" "}
                  · run <span className="font-mono text-foreground/80">{selectedTrainer.entrypoint}</span>
                </>
              )}
            </p>
          )}

          {isLive() && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Base model (optional)">
                <input
                  value={baseModel}
                  onChange={(e) => setBaseModel(e.target.value)}
                  placeholder="stabilityai/stable-diffusion-xl-base-1.0"
                  className={inputClass}
                />
              </Field>
              <label className="flex cursor-pointer items-end gap-2 pb-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={writeToDisk}
                  onChange={(e) => setWriteToDisk(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-accent-amber"
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

          {isLive() && (
            <button
              type="button"
              onClick={generate}
              disabled={busy || !exportDir.trim()}
              className="cursor-pointer rounded-lg bg-accent-amber px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Working…" : writeToDisk ? "Generate + write" : "Preview config"}
            </button>
          )}
        </section>

        {/* ── Generated files ────────────────────────────────────── */}
        {files.length > 0 && (
          <section className="space-y-4 rounded-xl border border-border bg-surface/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-foreground">
                {result && !result.files.some((f) => f.path) ? "Config preview" : "Config"}
              </h2>
              {result?.out_dir && (
                <span className="font-mono text-xs text-muted">{result.out_dir}</span>
              )}
            </div>

            {result?.warnings.map((w) => (
              <CapabilityNotice key={w} reason={w} />
            ))}

            {files.map((f) => (
              <div key={f.name} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-foreground/80">{f.name}</span>
                  <button
                    type="button"
                    // forge names a file by its path within the export
                    // (`forge/kohya/config.toml`); a download wants just the leaf.
                    onClick={() => downloadText(basename(f.name), f.content, "text/plain;charset=utf-8")}
                    className="cursor-pointer rounded-lg border border-border px-3 py-1 text-xs text-muted transition-colors hover:text-foreground"
                  >
                    Download
                  </button>
                </div>
                <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
                  {f.content}
                </pre>
              </div>
            ))}
          </section>
        )}

        {/* ── Training ───────────────────────────────────────────── */}
        <section className="space-y-3 rounded-xl border border-border bg-surface/50 p-5">
          <h2 className="text-sm font-medium text-foreground">Training</h2>
          {trainingReason ? (
            <CapabilityNotice reason={trainingReason} />
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
