"use client";

import { useState } from "react";
import { exportSelectionStream, type ExportProgress } from "@/lib/curatorApi";
import { captionManifestStream, type CaptionProgress, type CaptionSummary } from "@/lib/lensApi";
import { IS_LIVE, LENS_URL, LOCAL_OUTPUT_PATH } from "@/lib/curatorEnv";
import { MANIFEST_VERSION, datasetSizeStatus, type ExportResult, type ImageResult, type ScanSummary } from "./types";

const HINT_TONE: Record<string, string> = {
  empty: "border-border bg-background/60 text-muted",
  low: "border-accent-orange/30 bg-accent-orange/5 text-accent-orange",
  good: "border-accent-green/30 bg-accent-green/5 text-accent-green",
  high: "border-accent-orange/30 bg-accent-orange/5 text-accent-orange",
};

interface Props {
  summary: ScanSummary;
  selectedResults: ImageResult[];
}

type Mode = "copy" | "symlink" | "move";

/** Build the JSONL manifest client-side (used for the demo-mode download). */
function buildManifest(summary: ScanSummary, rows: ImageResult[]): string {
  return rows
    .map((r) =>
      JSON.stringify({
        manifest_version: MANIFEST_VERSION,
        rel_path: r.rel_path,
        abs_path: r.abs_path,
        target_profile: summary.target_profile,
        primary_face_cluster: r.primary_face_cluster,
        primary_face_pose: r.primary_face_pose,
        score: Number(r.score.toFixed(4)),
        similar_group: r.similar_group,
      }),
    )
    .join("\n");
}

export function ExportPanel({ summary, selectedResults }: Props) {
  const [dest, setDest] = useState(LOCAL_OUTPUT_PATH || "/data/out");
  const [mode, setMode] = useState<Mode>("copy");
  const [preserve, setPreserve] = useState(true);
  const [toCaption, setToCaption] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [transfer, setTransfer] = useState<ExportProgress | null>(null);
  const [caption, setCaption] = useState<CaptionProgress | null>(null);
  const [captionSummary, setCaptionSummary] = useState<CaptionSummary | null>(null);

  const count = selectedResults.length;
  const disabled = count === 0 || busy;
  const sizeHint = datasetSizeStatus(count, summary.target_profile.target_category);

  const runLiveExport = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setTransfer(null);
    setCaption(null);
    setCaptionSummary(null);
    try {
      // 1) Transfer files (+ manifest/report) on the curator, streaming progress.
      const res = await exportSelectionStream(
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
      );
      setResult(res);

      // 2) Optionally caption via argus-lens, streaming per-image progress.
      if (toCaption) {
        const jsonl = buildManifest(summary, selectedResults);
        const sum = await captionManifestStream(jsonl, setCaption);
        setCaptionSummary(sum);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadManifest = () => {
    const jsonl = buildManifest(summary, selectedResults);
    const blob = new Blob([jsonl + "\n"], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "manifest.jsonl";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
            placeholder="/data/out"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent-green/50 focus:outline-none focus:ring-1 focus:ring-accent-green/50"
          />
          <div className="flex gap-2">
            {(["copy", "symlink", "move"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                  mode === m
                    ? "border border-accent-teal/40 bg-accent-teal/20 text-accent-teal"
                    : "border border-border bg-background text-muted hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={preserve}
              onChange={(e) => setPreserve(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-accent-teal"
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
              className="h-4 w-4 cursor-pointer accent-accent-purple"
            />
            Then caption with argus-lens
          </label>
          <button
            type="button"
            disabled={disabled || !dest.trim()}
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
            <span className="font-mono text-foreground/80">manifest.jsonl</span> that a live export would hand to
            argus-lens.
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={downloadManifest}
            className="w-full cursor-pointer rounded-lg bg-accent-green/20 px-4 py-2.5 text-sm font-semibold text-accent-green transition-colors hover:bg-accent-green/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download manifest.jsonl
          </button>
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
              {captionSummary.failed > 0 ? ` (${captionSummary.failed} failed)` : ""} — .txt sidecars written next to
              each source image.
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
};

/** A labelled determinate progress bar for one export/caption phase. */
function PhaseBar({
  label,
  done,
  total,
  tone,
  pending = false,
  detail,
}: {
  label: string;
  done: number;
  total: number;
  tone: "teal" | "purple";
  pending?: boolean;
  detail?: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const t = BAR_TONE[tone];
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="text-foreground/85">{label}</span>
        <span className={`shrink-0 font-mono tabular-nums ${t.text}`}>
          {pending ? "waiting…" : `${done.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${t.bar} ${pending ? "animate-pulse" : ""}`}
          style={{ width: pending ? "10%" : `${pct}%` }}
        />
      </div>
      {detail && <p className="truncate font-mono text-[10px] text-muted">{detail}</p>}
    </div>
  );
}
