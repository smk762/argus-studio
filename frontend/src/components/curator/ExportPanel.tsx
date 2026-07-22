"use client";

import Link from "next/link";
import { useState } from "react";
import {
  allowsExport,
  allowsMove,
  exportSelectionStream,
  exportedAbsPath,
  exportedRelPath,
  speaksSupportedManifest,
  type ExportProgress,
  type Health,
  type NormalizedExportResult,
} from "@/lib/curatorApi";
import { captionManifestStream, type CaptionProgress, type CaptionSummary } from "@/lib/lensApi";
import { isLive, lensUrl, localOutputPath, localSourcePath } from "@/lib/curatorEnv";
import { capabilityReason, permits } from "@/lib/capabilities";
import { CapabilityNotice } from "@/components/CapabilityNotice";
import { joinPath, normalizeRoot } from "@/lib/path";
import { toJsonl } from "@/lib/jsonl";
import { downloadText } from "@/lib/download";
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

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The single place ImageResult -> ManifestRow happens. */
/**
 * The locators for one row. Named rather than positional: `exportedPath`,
 * `exportedAbs` and the source are all `string`, so a positional signature lets
 * a transposition type-check silently and ship a manifest argus-lens opens at
 * the wrong file.
 *
 * `moved` (not a pre-computed `absPath`) keeps the two-locator rule inside the
 * one function that builds rows: under `mode: "move"` the source is deleted, so
 * the readable location is the written one; otherwise the source stands.
 */
interface RowLocators {
  exportedPath: string;
  exportedAbs: string;
  moved: boolean;
  /** Version the *curator* declared for this export; the demo path stamps its own. */
  manifestVersion: string;
}

const manifestRow = (summary: ScanSummary, r: ImageResult, loc: RowLocators): ManifestRow => ({
  manifest_version: loc.manifestVersion,
  rel_path: r.rel_path,
  abs_path: loc.moved ? loc.exportedAbs : r.abs_path,
  exported_path: loc.exportedPath,
  exported_abs_path: loc.exportedAbs,
  target_profile: summary.target_profile,
  primary_face_cluster: r.primary_face_cluster,
  primary_face_pose: r.primary_face_pose,
  score: Number(r.score.toFixed(4)),
  similar_group: r.similar_group,
});

/**
 * Manifest rows for a completed live export: the files the curator reported a
 * destination for (normalized `exported_paths`, so this no longer knows about
 * manifest versions), each stamped with its reported `exported_path` and the
 * absolute the curator published for it — no path is rebuilt here.
 *
 * `abs_path` stays mode-dependent to match the curator's own manifest: under
 * move the source is gone so the row reads from the destination, otherwise the
 * still-present source image stays authoritative (argus-lens opens by abs_path).
 *
 * Rows can be fewer than the selection when a file wasn't transferred — see
 * `manifestHandoffProblem`, which decides whether the handoff is usable.
 */
function exportManifestRows(summary: ScanSummary, rows: ImageResult[], result: NormalizedExportResult): ManifestRow[] {
  const out: ManifestRow[] = [];
  const moved = result.mode === "move";
  // The curator's own declared version, not this app's constant: the row's
  // content is the server's, so the stamp must be too. Falls back to what we
  // build against only for a 2.0 curator, which declares it per row but not on
  // the result.
  const manifestVersion = result.manifest_version ?? MANIFEST_VERSION;
  for (const r of rows) {
    const exportedPath = exportedRelPath(result, r.rel_path);
    const exportedAbs = exportedAbsPath(result, r.rel_path);
    // Not transferred (or reported with an empty locator) — drop it rather than
    // emit a row naming the export directory itself.
    if (exportedPath === null || exportedAbs === null) continue;
    out.push(manifestRow(summary, r, { exportedPath, exportedAbs, moved, manifestVersion }));
  }
  return out;
}

/**
 * Why this export can't be handed to argus-lens, or null when it can.
 *
 * Checked before lens is involved, so a curator-side or compat problem is
 * never reported as an argus-lens failure.
 */
function manifestHandoffProblem(result: NormalizedExportResult, rowCount: number): string | null {
  if (result.manifestGap) return result.manifestGap;
  if (result.copied === 0) return `the curator transferred no files (${result.skipped} skipped)`;
  if (rowCount === 0) return "the export transferred files but none matched the manifest";
  if (rowCount < result.copied) {
    return `only ${rowCount} of ${result.copied} transferred files matched the manifest`;
  }
  return null;
}

/**
 * The manifest a live structure-preserving export would write, for the demo
 * download. Nothing relocates, so `exported_path` mirrors `rel_path` and
 * `abs_path` stays the source — but `exported_abs_path` must still name where
 * the export *would write*, under the destination root. Pointing it at the
 * source instead produced a self-contradictory row (a relative locator under the
 * export root beside an absolute in the source tree), which is exactly what the
 * 2.1 field exists to rule out, and made the download not match what lens
 * receives from a live run.
 */
function demoManifestRows(summary: ScanSummary, rows: ImageResult[], dest: string): ManifestRow[] {
  return rows.map((r) =>
    manifestRow(summary, r, {
      exportedPath: r.rel_path,
      exportedAbs: joinPath(dest, r.rel_path),
      moved: false,
      manifestVersion: MANIFEST_VERSION,
    }),
  );
}

export function ExportPanel({ summary, selectedResults, health }: Props) {
  const [dest, setDest] = useState(localOutputPath() || "/data/out");
  const [mode, setMode] = useState<Mode>("copy");
  const [preserve, setPreserve] = useState(true);
  const [toCaption, setToCaption] = useState(false);
  const [trigger, setTrigger] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NormalizedExportResult | null>(null);
  const [transfer, setTransfer] = useState<ExportProgress | null>(null);
  const [caption, setCaption] = useState<CaptionProgress | null>(null);
  const [captionSummary, setCaptionSummary] = useState<CaptionSummary | null>(null);
  // Why the completed export's manifest could not be handed downstream, or null.
  // Held in state so the result panel can contradict its own success line rather
  // than reporting a green "Copied N images" for an export nothing can consume.
  const [manifestProblem, setManifestProblem] = useState<string | null>(null);
  // Server capabilities derived from the parent's /health fetch (#66). Both gates
  // below fail SAFE on the not-yet-known `null` via permits().
  const allowMove = allowsMove(health);
  const canExport = allowsExport(health);
  const exportRootUnset = canExport === false;
  // Checked BEFORE the export, not after: normalizeExportResult can only refuse
  // once the transfer has finished, and under move that is after every source
  // file has been deleted. /health advertises the version, so an unreadable
  // curator can be refused while the files are still where they started.
  const manifestOk = speaksSupportedManifest(health);
  const manifestDenied = manifestOk === false;

  // No forge probe here any more: this panel exports, and /forge configures
  // training (argus-studio#78). Two entry points to POST /config meant two
  // trainer lists with different authority and two writers of the same
  // <export>/forge/<trainer>/ directory, silently overwriting each other.

  const count = selectedResults.length;
  const disabled = count === 0 || busy;
  const category = summary.target_profile.target_category;
  const sizeHint = datasetSizeStatus(count, category);

  // Foot-gun warnings about the destination itself. These used to be gated on
  // the forge checkbox; they apply to any export that will later be trained on,
  // which is every export, so they are unconditional now.
  // Trailing-slash-normalized so the root-equal compare below matches `d` (which
  // is also stripped); prefer the server's authoritative root when /health knows it.
  const exportRoot = normalizeRoot(health?.export_root || localOutputPath() || "/data/out");
  const sourceRoot = normalizeRoot(localSourcePath());
  const exportHints: string[] = [];
  {
    const d = normalizeRoot(dest.trim());
    if (d && d === exportRoot) {
      exportHints.push(
        `Destination is the shared export root, so every export lands in one folder — and argus-forge refuses the root outright. Use a subfolder like ${exportRoot}/my-subject.`,
      );
    }
    if (sourceRoot && d && (d === sourceRoot || d.startsWith(`${sourceRoot}/`))) {
      exportHints.push(
        "Destination is inside the dataset tree, which argus-forge mounts read-only — a training config cannot be written there. Export under the output dir instead.",
      );
    }
    if (preserve) {
      exportHints.push(
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
    setManifestProblem(null);
    const problems: string[] = [];
    // Snapshot what this run exports. Both are live props and the results grid
    // stays interactive while the transfer streams: changing the selection would
    // otherwise make the row count disagree with the server's `copied` and
    // trigger a bogus "only N of M matched" refusal, and re-scanning mid-export
    // would silently stamp every row with a different scan's target_profile.
    const runSummary = summary;
    const runResults = selectedResults;
    try {
      // 1) Transfer files (+ manifest/report) on the curator, streaming
      // progress. A failure here is fatal — the later steps need the export.
      const exported = await exportSelectionStream(
        {
          scan_id: runSummary.scan_id,
          selection: runResults.map((r) => r.rel_path),
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

      // The manifest handoff is validated ONCE, for every downstream consumer.
      // Scoping this to the caption branch meant an unreadable manifest was
      // silently ignored whenever captioning was unticked: the panel rendered a
      // plain success and still handed the export to forge, which then built a
      // training config over a contract this app had just declared it cannot
      // interpret. `rows` is built once here for the same reason.
      // Rows come from the export result, so the payload matches the
      // manifest.jsonl the curator wrote (transferred rows only) and, in move
      // mode, points at the exported files rather than vanished sources.
      const rows = exportManifestRows(runSummary, runResults, exported);
      const handoffGap = manifestHandoffProblem(exported, rows.length);
      if (handoffGap) problems.push(`Manifest handoff unusable: ${handoffGap}`);
      setManifestProblem(handoffGap);

      // 2) Optionally caption via argus-lens, streaming per-image progress.
      // Non-fatal, but in move mode the sources are gone and this run is the
      // only chance, so a lens outage is reported rather than retried.
      if (toCaption) {
        // Validated above: an empty or partial payload is a curator/compat
        // problem and must not be blamed on argus-lens, and streaming it anyway
        // would have lens no-op into a "0/0" success.
        if (handoffGap) {
          problems.push("Captioning skipped");
        } else {
          try {
            const sum = await captionManifestStream(toJsonl(rows), setCaption, {
              trigger_word: trigger.trim() || undefined,
            });
            setCaptionSummary(sum);
          } catch (err) {
            problems.push(`Captioning failed (argus-lens): ${errMsg(err)}`);
          }
        }
      }

      // The training config is NOT forged here — /forge owns that now
      // (argus-studio#78). The success panel links there with this export's
      // server-resolved dest, so the config is rendered once, against a trainer
      // list the server actually advertises.

      if (problems.length > 0) setError(problems.join(" — "));
    } finally {
      setBusy(false);
    }
  };

  const downloadManifest = () => {
    const jsonl = toJsonl(demoManifestRows(summary, selectedResults, dest.trim() || "/data/out"));
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

      {isLive() ? (
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
              const gated = m === "move" && !permits(allowMove);
              // capabilityReason covers BOTH negative cases: without it the
              // not-yet-known `null` produced a greyed button with no tooltip at
              // all, so a curator whose /health never answered left the control
              // dead and unexplained for the whole session.
              const moveReason = capabilityReason(
                allowMove,
                "Disabled on this server. Start the curator with --allow-move (CURATOR_ALLOW_MOVE=1) to permit destructive move exports.",
                "Checking whether this server permits destructive move exports…",
              );
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  disabled={busy || gated}
                  title={m === "move" ? (moveReason ?? undefined) : undefined}
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
            <CapabilityNotice
              reason={
                <>
                  The curator has no export root configured, so exports will fail. Set{" "}
                  <span className="font-mono">CURATOR_EXPORT_PATH</span> on the curator service.
                </>
              }
            />
          )}
          {manifestDenied && (
            <CapabilityNotice
              reason={
                <>
                  This curator writes manifest{" "}
                  <span className="font-mono">{health?.manifest_version}</span>, which this app cannot
                  read — nothing could be handed to argus-lens or argus-forge afterwards. Export is
                  disabled rather than refused after the files have already moved. Upgrade the
                  curator, or the studio, so the two agree.
                </>
              }
            />
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
            title={`After export, the manifest is streamed to ${lensUrl() || "this origin"}/caption/manifest/stream so you can watch captioning progress image-by-image.`}
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
          {/* The trigger belongs to captioning: argus-lens is what consumes it.
              It used to live under the forge checkbox, which meant a caption-only
              export silently dropped it. */}
          {toCaption && (
            <input
              type="text"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              disabled={busy}
              placeholder="Trigger word (optional — prepended to each caption)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent-purple/50 focus:outline-none focus:ring-1 focus:ring-accent-purple/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          )}
          {exportHints.length > 0 && (
            <ul className="space-y-1 text-[11px] leading-relaxed text-accent-orange/90">
              {exportHints.map((h, i) => (
                <li key={i}>! {h}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={disabled || !dest.trim() || !permits(canExport) || manifestDenied}
            onClick={() => void runLiveExport()}
            className="w-full cursor-pointer rounded-lg bg-accent-green/20 px-4 py-2.5 text-sm font-semibold text-accent-green transition-colors hover:bg-accent-green/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Working…" : `Export ${count}${toCaption ? " + caption" : " + manifest"}`}
          </button>

          {busy && (transfer || caption) && (
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
              The suggested params above, rendered as kohya sd-scripts TOML client-side.{" "}
              <Link href="/forge" className="text-accent-amber underline-offset-2 hover:underline">
                Forge
              </Link>{" "}
              does the same against a real export — and on a live host calls{" "}
              <span className="font-mono text-foreground/80">argus-forge</span>, which also handles
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
        <div
          className={`space-y-1 rounded-lg border p-3 text-xs ${
            manifestProblem
              ? "border-accent-orange/30 bg-accent-orange/5"
              : "border-accent-green/30 bg-accent-green/5"
          }`}
        >
          <div className={manifestProblem ? "text-accent-orange" : "text-accent-green"}>
            {result.mode === "move" ? "Moved" : result.mode === "symlink" ? "Symlinked" : "Copied"} {result.copied} images
            {result.skipped > 0 ? ` (${result.skipped} skipped)` : ""}.
          </div>
          {/* The transfer succeeded but nothing downstream can read it — say so
              here rather than letting a green box imply the handoff worked. */}
          {manifestProblem && (
            <div className="text-accent-orange/90">
              The files were transferred, but this app could not use the manifest: {manifestProblem}.
              Captioning and the training config were skipped.
            </div>
          )}
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
          {/* The handoff: carry the server-resolved dest (not the raw input —
              the curator rewrites it under its export root) so /forge inspects
              exactly what landed, without the user retyping a server path. */}
          {!manifestProblem && (
            <Link
              href={`/forge?export=${encodeURIComponent(result.dest)}`}
              className="inline-block rounded-lg border border-accent-amber/40 bg-accent-amber/10 px-3 py-1.5 text-xs font-medium text-accent-amber transition-colors hover:bg-accent-amber/20"
            >
              Configure training in Forge →
            </Link>
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
