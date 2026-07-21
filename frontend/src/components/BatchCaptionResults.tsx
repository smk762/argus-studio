"use client";

import { useState } from "react";
import type { BatchCaptionResult } from "@/types";
import { toJsonl } from "@/lib/jsonl";
import { downloadText } from "@/lib/download";

interface Props {
  result: BatchCaptionResult;
  /** Human label for the source (folder path or manifest filename). */
  source: string;
}

/** Renders the per-image results of a /caption/folder or /caption/manifest run. */
export function BatchCaptionResults({ result, source }: Props) {
  const [copied, setCopied] = useState(false);

  const asJsonl = toJsonl(result.results);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(asJsonl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const download = () => downloadText("captions.jsonl", asJsonl + "\n", "application/x-ndjson");

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4">
        <Stat label="Captioned" value={result.captioned} tone="text-accent-green" />
        <Stat label="Failed" value={result.failed} tone={result.failed ? "text-accent-red" : "text-muted"} />
        <Stat label="Total" value={result.total} tone="text-foreground" />
        <div className="min-w-0 flex-1 truncate text-right font-mono text-xs text-muted" title={source}>
          {source}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyAll}
            disabled={result.results.length === 0}
            className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-40"
          >
            {copied ? "Copied" : "Copy JSONL"}
          </button>
          <button
            type="button"
            onClick={download}
            disabled={result.results.length === 0}
            className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-40"
          >
            Download
          </button>
        </div>
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="rounded-lg border border-accent-red/30 bg-accent-red/5 p-3">
          <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent-red">
            {result.errors.length} error{result.errors.length > 1 ? "s" : ""}
          </h3>
          <ul className="space-y-0.5 text-xs text-accent-red/90">
            {result.errors.slice(0, 20).map((e, i) => (
              <li key={i} className="font-mono">
                <span className="text-accent-red">{e.rel_path}</span>: {e.error}
              </li>
            ))}
            {result.errors.length > 20 && <li className="text-muted">…and {result.errors.length - 20} more</li>}
          </ul>
        </div>
      )}

      {/* Rows */}
      {result.results.length > 0 && (
        <div className="scrollbar-thin max-h-[60vh] overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2 font-semibold">Image</th>
                <th className="px-3 py-2 font-semibold">final_caption</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((r) => (
                <tr key={r.rel_path} className="border-t border-border align-top hover:bg-surface-hover/50">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-accent-purple/90">{r.rel_path}</td>
                  <td className="px-3 py-2 leading-relaxed text-foreground/90">{r.final_caption}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`font-mono text-lg font-bold tabular-nums ${tone}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
    </div>
  );
}
