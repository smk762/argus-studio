"use client";

import { useState, type ReactNode } from "react";

import { bucketCategories, bucketsOf, splitTags, traceVariant } from "@/lib/captionExplain";
import { refineOf } from "@/lib/captionRefine";
import type { CaptionResult } from "@/types";

const label = (name: string) => name.replace(/_/g, " ");

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="space-y-2">
      <h3 className="text-xs font-semibold text-foreground/90">
        <span className="mr-2 font-mono text-muted">{n}</span>
        {title}
      </h3>
      {children}
    </li>
  );
}

function Chip({ children, struck = false, title }: { children: ReactNode; struck?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={`rounded border border-border bg-background px-1.5 py-0.5 text-[11px] ${
        struck ? "text-muted line-through" : "text-foreground/90"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * How this caption was built, from the model's raw output to one variant. Lens
 * already sends all of it. What was cut and why is under Auto-removed, and the
 * headcount has its own panel, so neither is repeated here.
 */
export function CaptionExplain({ result }: { result: CaptionResult }) {
  const [expanded, setExpanded] = useState(false);
  const [picked, setPicked] = useState(result.selected_category);

  const buckets = bucketsOf(result.metadata);
  if (!buckets) return null;

  const variants = Object.keys(result.caption_variants);
  const variant = variants.includes(picked) ? picked : (variants[0] ?? "");
  const trace = traceVariant(result, buckets, variant);
  const stripped = new Set(trace.stripped);
  const rewritten = refineOf(result.metadata)?.accepted.includes(variant) ?? false;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted uppercase hover:text-foreground transition-colors cursor-pointer"
      >
        EXPLAIN THIS CAPTION
        <span className="text-[10px] font-normal normal-case tracking-normal text-muted">{expanded ? "▼" : "▶"}</span>
      </button>

      {expanded && (
        <ol className="rounded-lg border border-border bg-surface p-4 space-y-5">
          <Step n={1} title={`Raw model output (${result.backend_name || "unknown backend"})`}>
            {result.raw_tags && (
              <div className="flex flex-wrap gap-1">
                {[...new Set(splitTags(result.raw_tags))].map((tag) => (
                  <Chip key={tag} struck={stripped.has(tag)} title={stripped.has(tag) ? "Dropped before classification" : undefined}>
                    {tag}
                  </Chip>
                ))}
              </div>
            )}
            {result.raw_prose && <p className="text-xs leading-relaxed text-muted italic">{result.raw_prose}</p>}
            {trace.stripped.length > 0 && (
              <p className="text-[11px] text-muted">
                Struck-through tags never reach a category: rating and meta tags carry no training value.
              </p>
            )}
          </Step>

          <Step n={2} title="Classified into categories">
            <ul className="space-y-2">
              {bucketCategories(buckets).map((category) => (
                <li key={category}>
                  <p className="mb-1 text-[11px] text-muted capitalize">{label(category)}</p>
                  <div className="flex flex-wrap gap-1">
                    {(buckets.tags[category] ?? []).map((tag) => (
                      <Chip key={`tag-${tag}`}>{tag}</Chip>
                    ))}
                    {(buckets.prose[category] ?? []).map((prose) => (
                      <Chip key={`prose-${prose}`} title="Prose fragment">
                        “{prose}”
                      </Chip>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Step>

          <Step n={3} title="Specialised into a variant">
            <label className="flex items-center gap-2 text-[11px] text-muted">
              Variant
              <select
                value={variant}
                onChange={(e) => setPicked(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground capitalize"
              >
                {variants.map((name) => (
                  <option key={name} value={name}>
                    {label(name)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-1">
              {trace.fragments.map((fragment) => (
                <Chip
                  key={`${fragment.source}-${fragment.category}-${fragment.text}`}
                  struck={!fragment.kept}
                  title={fragment.kept ? `Kept (${label(fragment.category)})` : "Not in this variant"}
                >
                  {fragment.source === "prose" ? `“${fragment.text}”` : fragment.text}
                </Chip>
              ))}
            </div>
            {rewritten && (
              <p className="text-[11px] text-accent-amber-ink">
                An LLM rewrote this variant, so a struck-through fragment may have been reworded rather than dropped.
              </p>
            )}
            <p className="rounded border border-border bg-background p-3 text-xs leading-relaxed text-foreground/80">
              {result.caption_variants[variant]}
            </p>
          </Step>
        </ol>
      )}
    </div>
  );
}
