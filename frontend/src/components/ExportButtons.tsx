"use client";

import type { CaptionResult } from "@/types";
import { resultToCSV, resultToJSON } from "@/lib/captionFinal";
import { downloadText } from "@/lib/download";

interface ExportButtonsProps {
  result: CaptionResult;
  /** A variant chosen as final on this page, which the exports follow. */
  finalVariant: string | null;
  imageUrl: string;
}

export function ExportButtons({ result, finalVariant, imageUrl }: ExportButtonsProps) {
  const handleJSON = () => {
    downloadText("argus-lens-result.json", resultToJSON(result, imageUrl, finalVariant), "application/json");
  };

  const handleCSV = () => {
    downloadText("argus-lens-result.csv", resultToCSV(result, imageUrl, finalVariant), "text/csv");
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
