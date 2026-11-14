"use client";

import { useState } from "react";
import type { CaptionResult } from "@/types";

interface RawOutputsProps {
  result: CaptionResult;
}

export function RawOutputs({ result }: RawOutputsProps) {
  const [expanded, setExpanded] = useState(true);

  const tags = result.raw_tags
    ? result.raw_tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const removedSet = new Set(
    result.removed_phrases.map((p) => p.trim().toLowerCase())
  );

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted uppercase hover:text-foreground transition-colors cursor-pointer"
      >
        <span
          className="inline-block w-3 h-3 rounded-sm"
          style={{ backgroundColor: expanded ? "var(--dh-warn)" : "var(--dh-muted)" }}
        />
        RAW MODEL OUTPUTS
        <span className="text-[10px] font-normal normal-case tracking-normal text-muted">
          {expanded ? "▼" : "▶"}
        </span>
      </button>

      {expanded && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-5">
          {/* WD14 / tag output */}
          {tags.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold tracking-wider text-foreground/70">
                  WD14 TAGS
                </h3>
                <span className="text-[10px] text-muted">
                  {tags.length} tags
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const isRemoved = removedSet.has(tag.toLowerCase());
                  return (
                    <span
                      key={tag}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs transition-colors ${
                        isRemoved
                          ? "bg-transparent border border-border text-muted line-through"
                          : "bg-accent-purple/20 border border-accent-purple/40 text-accent-purple-ink"
                      }`}
                    >
                      {isRemoved ? "−" : "+"} {tag.replace(/_/g, " ")}
                    </span>
                  );
                })}
              </div>
              <div className="mt-3 p-2.5 rounded bg-background/50 border border-border/50">
                <p className="text-xs font-mono text-muted leading-relaxed break-all">
                  {result.raw_tags}
                </p>
              </div>
            </div>
          )}

          {/* Prose output */}
          {result.raw_prose && (
            <div>
              <h3 className="text-xs font-bold tracking-wider text-foreground/70 mb-3">
                {result.backend_name.toUpperCase().replace(/_/g, " ") || "PROSE"}
              </h3>
              <div className="p-3 rounded bg-background/50 border border-border/50">
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {result.raw_prose}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
