"use client";

import type { CaptionResult } from "@/types";
import { downloadText } from "@/lib/download";

interface ExportButtonsProps {
  result: CaptionResult;
  imageUrl: string;
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function resultToCSV(result: CaptionResult, imageUrl: string): string {
  const headers = [
    "image_url",
    "variant",
    "caption",
    "backend",
    "selected_category",
    "raw_tags",
    "raw_prose",
    "removed_phrases",
    "compaction_notes",
  ];

  const rows: string[][] = [];

  rows.push([
    imageUrl,
    "__final",
    result.final_caption,
    result.backend_name,
    result.selected_category,
    result.raw_tags,
    result.raw_prose,
    result.removed_phrases.join("; "),
    result.compaction_notes.join("; "),
  ]);

  for (const [variant, caption] of Object.entries(result.caption_variants)) {
    rows.push([
      imageUrl,
      variant,
      caption,
      result.backend_name,
      result.selected_category,
      "",
      "",
      "",
      "",
    ]);
  }

  const csvLines = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ];

  return csvLines.join("\n") + "\n";
}

export function ExportButtons({ result, imageUrl }: ExportButtonsProps) {
  const handleJSON = () => {
    const data = JSON.stringify({ image_url: imageUrl, ...result }, null, 2);
    downloadText("argus-lens-result.json", data, "application/json");
  };

  const handleCSV = () => {
    downloadText("argus-lens-result.csv", resultToCSV(result, imageUrl), "text/csv");
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">Export:</span>
      <button
        onClick={handleJSON}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface border border-border text-xs text-foreground/80 hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        JSON
      </button>
      <button
        onClick={handleCSV}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface border border-border text-xs text-foreground/80 hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        CSV
      </button>
    </div>
  );
}
