"use client";

import { useState } from "react";
import {
  exportSelectionStream,
  type ExportProgress,
  type Health,
  type NormalizedExportResult,
} from "@/lib/curatorApi";
import { captionManifestStream, type CaptionProgress, type CaptionSummary } from "@/lib/lensApi";
import { forgeConfig, TRAINER_LABELS, type ForgeResult, type TrainerId } from "@/lib/forgeApi";
import { FORGE_URL, IS_LIVE, LENS_URL, LOCAL_OUTPUT_PATH, LOCAL_SOURCE_PATH } from "@/lib/curatorEnv";
import { normalizeRoot } from "@/lib/path";
import { toJsonl } from "@/lib/jsonl";
import { buildKohyaConfigToml, buildKohyaDatasetToml } from "./forgeDemo";
import {
  MANIFEST_VERSION,
  datasetSizeStatus,
  type ImageResult,
  type ManifestRow,
  type ScanSummary,
} from "./types";

const HINT_TONE: Record<string, string> = {
  empty: "border-border bg-background/60 text-muted",
  low: "border-accent-orange/30 bg-accent-orange/5 text-accent-orange",
  good: "border-accent-green/30 bg-accent-green/5 text-accent-green",
  high: "border-accent-orange/30 bg-accent-orange/5 text-accent-orange",
};

interface Props {
  summary: ScanSummary;
  selectedResults: ImageResult[];
  /** Curator /health, fetched once by the parent (live only; null until known). */
  health: Health | null;
}

type Mode = "copy" | "symlink" | "move";

/** Filename-safe slug, mirroring argus-forge's slugify (core.py). */
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** One file's locators within a manifest, or null to drop it from the manifest. */
type RowLocator = { exportedPath: string; absPath: string } | null;

/**
 * Build manifest 2.0 rows for `rows`, resolving each image's `exported_path`
 * and `abs_path` via `locate` (return null to omit a file). The single place
 * ImageResult -> ManifestRow happens, shared by the live-export and demo paths.
 */
function buildManifestRows(
  summary: ScanSummary,
  rows: ImageResult[],
  locate: (r: ImageResult) => RowLocator,
): ManifestRow[] {
  return rows.flatMap((r) => {
    const loc = locate(r);
    if (!loc) return [];
    return [
      {
        manifest_version: MANIFEST_VERSION,
        rel_path: r.rel_path,
        abs_path: loc.absPath,
        exported_path: loc.exportedPath,
        target_profile: summary.target_profile,
        primary_face_cluster: r.primary_face_cluster,
        primary_face_pose: r.primary_face_pose,
        score: Number(r.score.toFixed(4)),
        similar_group: r.similar_group,
      },
    ];
  });
}

/**
 * Manifest rows for a completed live export: only the files whose transfer the
 * curator reported (normalized `exported_paths`, so this no longer knows about
 * manifest versions), each stamped with its reported `exported_path`. In move
 * mode the sources are gone, so the seam-resolved absolute is used; otherwise
 * the source image stays authoritative — either way, no path is rebuilt here.
 */
function exportManifestRows(summary: ScanSummary, rows: ImageResult[], result: NormalizedExportResult): ManifestRow[] {
  return buildManifestRows(summary, rows, (r) => {
    const exportedPath = result.exported_paths[r.rel_path];
    if (exportedPath == null) return null; // not transferred — drop it
    return { exportedPath, absPath: result.exported_abs_paths[r.rel_path] ?? r.abs_path };
  });
}

/**
 * The manifest a live structure-preserving export would write, for the demo
 * download — same 2.0 shape (no relocation, so `exported_path` mirrors
 * `rel_path` and the source stays authoritative), so the file you download
 * matches what lens receives.
 */
function demoManifestRows(summary: ScanSummary, rows: ImageResult[]): ManifestRow[] {
  return buildManifestRows(summary, rows, (r) => ({ exportedPath: r.rel_path, absPath: r.abs_path }));
}

export function ExportPanel({ summary, selectedResults, health }: Props) {
  const [dest, setDest] = useState(LOCAL_OUTPUT_PATH || "/data/out");
  const [mode, setMode] = useState<Mode>("copy");
  const [preserve, setPreserve] = useState(true);
  const [toCaption, setToCaption] = useState(false);
  const [toForge, setToForge] = useState(false);
  const [trainer, setTrainer] = useState<TrainerId>("kohya");
  const [trigger, setTrigger] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NormalizedExportResult | null>(null);
  const [transfer, setTransfer] = useState<ExportProgress | null>(null);
  const [caption, setCaption] = useState<CaptionProgress | null>(null);
  const [captionSummary, setCaptionSummary] = useState<CaptionSummary | null>(null);
  const [forgeRunning, setForgeRunning] = useState(false);
  const [forgeResult, setForgeResult] = useState<ForgeResult | null>(null);
  // Server capabilities derived from the parent's /health fetch.
  //   allowMove: true = permitted, false = server rejects move, null = not yet
  //   known (still loading OR /health failed). Older servers omit allow_move —
  //   treat that as permitted. The move gate below fails SAFE on null.
  const allowMove = health ? (health.allow_move ?? true) : null;
  // Present-and-null export_root means every live export 400s; a missing field
  // (older server) or a real path is fine.
  const exportRootUnset = health?.export_root === null;

  const count = selectedResults.length;
  const disabled = count === 0 || busy;
  const category = summary.target_profile.target_category;
  const sizeHint = datasetSizeStatus(count, category);

  // Foot-gun warnings for the forge step (degenerate default dest, read-only
  // dataset mount, kohya's non-recursive image glob).
  // Trailing-slash-normalized so the root-equal compare below matches `d` (which
  // is also stripped); prefer the server's authoritative root when /health knows it.
  const exportRoot = normalizeRoot(health?.export_root || LOCAL_OUTPUT_PATH || "/data/out");
  const forgeHints: string[] = [];
  if (toForge) {
    const d = normalizeRoot(dest.trim());
    if (d === exportRoot) {
      forgeHints.push(
        `Destination is the shared export root, so forge derives the trigger ("${d.split("/").pop()}") and sizes params from everything in it. Use a subfolder like ${exportRoot}/my-subject.`,
      );
    }
    if (LOCAL_SOURCE_PATH && (d === LOCAL_SOURCE_PATH || d.startsWith(`${LOCAL_SOURCE_PATH}/`))) {
      forgeHints.push(
        "Destination is inside the dataset tree, which argus-forge mounts read-only — the forge step will fail. Export under the output dir instead.",
      );
    }
    if (trainer === "kohya" && preserve) {
      forgeHints.push(
        "kohya sd-scripts reads images from the export root only — uncheck “Preserve folder structure” if your selection includes subfolders.",
      );
    }
  }

  const runLiveExport = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setTransfer(null);
    setCaption(null);
    setCaptionSummary(null);
    setForgeRunning(false);
    setForgeResult(null);
    const problems: string[] = [];
    try {
      // 1) Transfer files (+ manifest/report) on the curator, streaming
      // progress. A failure here is fatal — the later steps need the export.
      const exported = await exportSelectionStream(
        {
          scan_id: summary.scan_id,
          selection: selectedResults.map((r) => r.rel_path),
          dest: dest.trim(),
          mode,
          preserve_structure: preserve,
          min_score: 0,
          include_rejected: true,
          keep_similar: true,
          write_manifest: true,
          caption_url: null, // captioning is orchestrated below for live progress
        },
        setTransfer,
      ).catch((err: unknown) => {
        setError(`Export failed (argus-curator): ${errMsg(err)}`);
        return null;
      });
      if (exported === null) return;
      setResult(exported);

      // 2) Optionally caption via argus-lens, streaming per-image progress.
      // Non-fatal: forge handles caption-less exports (trigger fallback +
      // warning), so a lens outage shouldn't cost the training config — in
      // move mode the sources are gone and this run is the only chance.
      if (toCaption) {
        try {
          // Manifest 2.0, built from the export result so the payload matches
          // the manifest.jsonl the curator wrote (transferred rows only) and, in
          // move mode, points at the exported files rather than vanished sources.
          const rows = exportManifestRows(summary, selectedResults, exported);
          if (rows.length === 0 && exported.copied > 0) {
            // A non-empty export that yields no manifest rows means the curator's
            // exported_paths keys didn't line up with the selection — surface it
            // instead of silently streaming an empty payload lens no-ops on.
            throw new Error("export transferred files but none matched the manifest — nothing to caption");
          }
          const jsonl = toJsonl(rows);
          const sum = await captionManifestStream(jsonl, setCaption, {
            trigger_word: toForge ? trigger.trim() : undefined,
          });
          setCaptionSummary(sum);
        } catch (err) {
          problems.push(`Captioning failed (argus-lens): ${errMsg(err)}`);
        }
      }

      // 3) Optionally forge a training config. Runs after captioning so forge
      // can collect the fresh .txt sidecars into the export dir.
      if (toForge) {
        setForgeRunning(true);
        try {
          const forged = await forgeConfig({
            export_dir: dest.trim(),
            trainer,
            trigger: trigger.trim() || null,
            // Pair the output name with the trigger (like demo mode does);
            // otherwise forge falls back to slugifying the export dir name.
            output_name: trigger.trim() ? `${slugify(trigger)}-lora` : null,
            // Don't leave the category to manifest sniffing — send what the
            // panel's own suggestions were computed from.
            category,
          });
          setForgeResult(forged);
        } catch (err) {
          problems.push(`Forge failed (argus-forge at ${FORGE_URL}): ${errMsg(err)}`);
        } finally {
          setForgeRunning(false);
        }
      }

      if (problems.length > 0) setError(problems.join(" — "));
    } finally {
      setBusy(false);
    }
  };

  const downloadText = (filename: string, text: string, mime: string) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadManifest = () => {
    const jsonl = toJsonl(demoManifestRows(summary, selectedResults));
    downloadText("manifest.jsonl", jsonl + "\n", "application/x-ndjson");
  };

  const downloadDemoKohya = (file: "dataset.toml" | "config.toml") => {
    const text =
      file === "dataset.toml"
        ? buildKohyaDatasetToml(count, category, "my_subject")
        : buildKohyaConfigToml(count, category, "my_subject-lora");
    downloadText(file, text, "application/toml");
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted">Export</label>
        <span className="rounded-md border border-accent-green/40 bg-accent-green/10 px-2 py-0.5 text-xs font-medium text-accent-green">
          {count} selected
        </span>
      </div>

      <p className={`rounded-lg border p-2.5 text-[11px] leading-relaxed ${HINT_TONE[sizeHint.tone]}`}>
        {sizeHint.text}
      </p>

      {IS_LIVE ? (
        <>
          <p className="text-[11px] leading-relaxed text-muted">
            Transfers the selected images to a folder on the curator host and writes{" "}
            <span className="font-mono text-foreground/80">manifest.jsonl</span> for argus-lens.
          </p>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted">Destination</label>
          <input
            type="text"
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            disabled={busy}
            placeholder="/data/out"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent-green/50 focus:outline-none focus:ring-1 focus:ring-accent-green/50 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex gap-2">
            {(["copy", "symlink", "move"] as Mode[]).map((m) => {
              // The server rejects move with 403 unless started with
              // --allow-move / CURATOR_ALLOW_MOVE=1. Fail SAFE: disable move
              // unless health positively permits it (allowMove === true), so a
              // still-loading or unreachable /health can't leave a destructive
              // move armed and surface a raw 403 after the user commits.
              const gated = m === "move" && allowMove !== true;
              const moveDenied = m === "move" && allowMove === false;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  disabled={busy || gated}
                  title={
                    moveDenied
                      ? "Disabled on this server. Start the curator with --allow-move (CURATOR_ALLOW_MOVE=1) to permit destructive move exports."
                      : undefined
                  }
                  className={`flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    mode === m
                      ? "border border-accent-teal/40 bg-accent-teal/20 text-accent-teal"
                      : "border border-border bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
          {exportRootUnset && (
            <p className="rounded-lg border border-accent-orange/30 bg-accent-orange/5 px-3 py-2 text-[11px] leading-relaxed text-accent-orange">
              The curator has no export root configured, so exports will fail.
              Set <span className="font-mono">CURATOR_EXPORT_PATH</span> on the curator service.
            </p>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={preserve}
              onChange={(e) => setPreserve(e.target.checked)}
              disabled={busy}
              className="h-4 w-4 cursor-pointer accent-accent-teal disabled:cursor-not-allowed disabled:opacity-50"
            />
            Preserve folder structure
          </label>
          <label
            className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
            title={`After export, the manifest is streamed to ${LENS_URL}/caption/manifest/stream so you can watch captioning progress image-by-image.`}
          >
            <input
              type="checkbox"
              checked={toCaption}
              onChange={(e) => setToCaption(e.target.checked)}
              disabled={busy}
              className="h-4 w-4 cursor-pointer accent-accent-purple disabled:cursor-not-allowed disabled:opacity-50"
            />
            Then caption with argus-lens
          </label>
          <label
            className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
            title="After export (and captioning), argus-forge turns the manifest + sidecars into a ready-to-run training config under <dest>/forge/."
          >
            <input
              type="checkbox"
              checked={toForge}
              onChange={(e) => setToForge(e.target.checked)}
              disabled={busy}
              className="h-4 w-4 cursor-pointer accent-accent-orange disabled:cursor-not-allowed disabled:opacity-50"
            />
            Then forge training config
          </label>
          {toForge && (
            <div className="space-y-2 rounded-lg border border-border bg-background/50 p-2.5">
              <div className="flex gap-2">
                {(Object.keys(TRAINER_LABELS) as TrainerId[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTrainer(t)}
                    disabled={busy}
                    className={`flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      trainer === t
                        ? "border border-accent-orange/40 bg-accent-orange/20 text-accent-orange"
                        : "border border-border bg-background text-muted hover:text-foreground"
                    }`}
                  >
                    {TRAINER_LABELS[t]}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                disabled={busy}
                placeholder="Trigger word (default: export folder name)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent-orange/50 focus:outline-none focus:ring-1 focus:ring-accent-orange/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {forgeHints.length > 0 && (
                <ul className="space-y-1 text-[11px] leading-relaxed text-accent-orange/90">
                  {forgeHints.map((h, i) => (
                    <li key={i}>! {h}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button
            type="button"
            disabled={disabled || !dest.trim() || exportRootUnset}
            onClick={() => void runLiveExport()}
            className="w-full cursor-pointer rounded-lg bg-accent-green/20 px-4 py-2.5 text-sm font-semibold text-accent-green transition-colors hover:bg-accent-green/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy
              ? "Working…"
              : `Export ${count}${toCaption ? " + caption" : ""}${toForge ? " + forge" : ""}${
                  !toCaption && !toForge ? " + manifest" : ""
                }`}
          </button>

          {busy && (transfer || caption || forgeRunning) && (
            <div className="space-y-3 rounded-lg border border-border bg-background/50 p-3">
              {transfer && (
                <PhaseBar
                  label={mode === "move" ? "Moving images" : mode === "symlink" ? "Symlinking images" : "Copying images"}
                  done={transfer.done}
                  total={transfer.total}
                  tone="teal"
                />
              )}
              {toCaption && (
                <PhaseBar
                  label="Captioning with argus-lens"
                  done={caption?.done ?? 0}
                  total={caption?.total ?? count}
                  tone="purple"
                  pending={!caption && !!transfer && transfer.done >= transfer.total}
                  detail={caption?.rel_path}
                />
              )}
              {toForge && (
                <PhaseBar
                  label={`Forging ${TRAINER_LABELS[trainer]} config`}
                  done={forgeResult ? 1 : 0}
                  total={1}
                  tone="orange"
                  pending={!forgeRunning && !forgeResult}
                  indeterminate={forgeRunning}
                  detail={forgeRunning ? "collecting caption sidecars + rendering configs…" : undefined}
                />
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-[11px] leading-relaxed text-muted">
            Read-only sample. Download the{" "}
            <span className="font-mono text-foreground/80">manifest.jsonl</span> that a live structure-preserving
            export would hand to argus-lens.
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={downloadManifest}
            className="w-full cursor-pointer rounded-lg bg-accent-green/20 px-4 py-2.5 text-sm font-semibold text-accent-green transition-colors hover:bg-accent-green/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download manifest.jsonl
          </button>
          <div className="space-y-2 rounded-lg border border-border bg-background/60 p-2.5">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">
              Forge kohya config (demo)
            </span>
            <p className="text-[11px] leading-relaxed text-muted">
              The suggested params above, rendered as kohya sd-scripts TOML client-side. A live run calls{" "}
              <span className="font-mono text-foreground/80">argus-forge</span> instead — which also handles
              OneTrainer/diffusers and collects caption sidecars.
            </p>
            <div className="flex gap-2">
              {(["dataset.toml", "config.toml"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  disabled={disabled}
                  onClick={() => downloadDemoKohya(f)}
                  className="flex-1 cursor-pointer rounded-lg border border-accent-orange/40 bg-accent-orange/10 px-2 py-1.5 font-mono text-xs font-medium text-accent-orange transition-colors hover:bg-accent-orange/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="rounded-lg border border-accent-red/30 bg-accent-red/5 p-2.5 text-xs text-accent-red">{error}</div>
      )}
      {result && (
        <div className="space-y-1 rounded-lg border border-accent-green/30 bg-accent-green/5 p-3 text-xs">
          <div className="text-accent-green">
            {result.mode === "move" ? "Moved" : result.mode === "symlink" ? "Symlinked" : "Copied"} {result.copied} images
            {result.skipped > 0 ? ` (${result.skipped} skipped)` : ""}.
          </div>
          {result.manifest_path && (
            <div className="break-all font-mono text-[11px] text-foreground/80">{result.manifest_path}</div>
          )}
          {captionSummary && (
            <div className="text-accent-purple">
              Captioned {captionSummary.captioned}/{captionSummary.total} with argus-lens
              {captionSummary.failed > 0 ? ` (${captionSummary.failed} failed)` : ""} — .txt sidecars written{" "}
              {result?.mode === "move" ? "into the export folder" : "next to each source image"}.
            </div>
          )}
          {forgeResult && (
            <div className="space-y-1">
              <div className="text-accent-orange">
                Forged {TRAINER_LABELS[forgeResult.trainer]} config ({forgeResult.params.images} images ×{" "}
                {forgeResult.params.repeats} repeats × {forgeResult.params.epochs} epochs ≈{" "}
                {forgeResult.params.total_steps.toLocaleString()} samples
                {forgeResult.captions_collected > 0
                  ? `, ${forgeResult.captions_collected} captions collected`
                  : ""}
                ).
              </div>
              <div className="break-all font-mono text-[11px] text-foreground/80">{forgeResult.out_dir}</div>
              {forgeResult.warnings.map((w, i) => (
                <div key={i} className="text-[11px] text-accent-orange/80">
                  ! {w}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const BAR_TONE: Record<string, { bar: string; text: string }> = {
  teal: { bar: "bg-accent-teal", text: "text-accent-teal" },
  purple: { bar: "bg-accent-purple", text: "text-accent-purple" },
  orange: { bar: "bg-accent-orange", text: "text-accent-orange" },
};

/**
 * A labelled progress bar for one export/caption/forge phase. `pending` =
 * queued behind an earlier phase ("waiting…"); `indeterminate` = actively
 * running but without granular progress (a single long request).
 */
function PhaseBar({
  label,
  done,
  total,
  tone,
  pending = false,
  indeterminate = false,
  detail,
}: {
  label: string;
  done: number;
  total: number;
  tone: "teal" | "purple" | "orange";
  pending?: boolean;
  indeterminate?: boolean;
  detail?: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const t = BAR_TONE[tone];
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="text-foreground/85">{label}</span>
        <span className={`shrink-0 font-mono tabular-nums ${t.text}`}>
          {pending
            ? "waiting…"
            : indeterminate
              ? "running…"
              : `${done.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${t.bar} ${
            pending || indeterminate ? "animate-pulse" : ""
          }`}
          style={{ width: pending ? "10%" : indeterminate ? "60%" : `${pct}%` }}
        />
      </div>
      {detail && <p className="truncate font-mono text-[10px] text-muted">{detail}</p>}
    </div>
  );
}
