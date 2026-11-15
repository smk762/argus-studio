"use client";

import { useState } from "react";
import type { CaptionResult } from "@/types";

interface AutoRemovedProps {
  result: CaptionResult;
}

export function AutoRemoved({ result }: AutoRemovedProps) {
  const [expanded, setExpanded] = useState(true);

  if (
    result.removed_phrases.length === 0 &&
    result.compaction_notes.length === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted uppercase hover:text-foreground transition-colors cursor-pointer"
      >
        AUTO-REMOVED
        <span className="text-[10px] font-normal normal-case tracking-normal text-muted">
          {expanded ? "▼" : "▶"}
        </span>
      </button>

      {expanded && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
          {result.removed_phrases.length > 0 && (
            <div>
              <h3 className="text-xs font-bold tracking-wider text-foreground/70 mb-3">
                Removed phrases
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {result.removed_phrases.map((phrase, i) => (
                  <span
                    key={`${phrase}-${i}`}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-transparent border border-border text-muted"
                  >
                    + {phrase}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.compaction_notes.length > 0 && (
            <div>
              <h3 className="text-xs font-bold tracking-wider text-foreground/70 mb-2">
                Compaction notes
              </h3>
              <ul className="space-y-1">
                {result.compaction_notes.map((note, i) => (
                  <li
                    key={i}
                    className="text-xs text-muted leading-relaxed"
                  >
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
