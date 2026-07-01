"use client";

import { useState } from "react";
import { exportSelection } from "@/lib/curatorApi";
import { IS_LIVE, LENS_URL, LOCAL_OUTPUT_PATH } from "@/lib/curatorEnv";
import type { ExportResult, ImageResult, ScanSummary } from "./types";

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
        rel_path: r.rel_path,
        abs_path: r.abs_path,
        target_profile: summary.target_profile,
        primary_face_cluster: r.primary_face_cluster,
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

  const count = selectedResults.length;
  const disabled = count === 0 || busy;

  const runLiveExport = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await exportSelection({
        scan_id: summary.scan_id,
        selection: selectedResults.map((r) => r.rel_path),
        dest: dest.trim(),
        mode,
        preserve_structure: preserve,
        min_score: 0,
        include_rejected: true,
        keep_similar: true,
        write_manifest: true,
        caption_url: toCaption ? `${LENS_URL}/caption/manifest` : null,
      });
      setResult(res);
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
            title={`POSTs the manifest to ${LENS_URL}/caption/manifest for a one-click curate → caption run.`}
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
            {busy ? "Exporting…" : `Export ${count}${toCaption ? " + caption" : " + manifest"}`}
          </button>
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
          {result.captioned && <div className="text-accent-purple">Manifest sent to argus-lens for captioning.</div>}
        </div>
      )}
    </div>
  );
}
