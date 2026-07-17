"use client";

import { useState } from "react";

/**
 * Live, embeddable widget for the Prose Enrichment doc page. `prose_enrichment`
 * is a boolean, so the thing worth showing is what the flag *does* to the
 * training caption: novel prose phrases appended at low priority, after the
 * tags that carry the concept.
 *
 * The tags and prose below are a worked example rather than live model output —
 * the behaviour they illustrate (novel phrases only, appended last) is real.
 */
const BASE_TAGS = ["sks woman", "wool coat", "city street", "night"];

/** Florence-2 prose for the same image, and what survives extraction. */
const PROSE = "A woman in a wool coat stands on a rain-slick city street at night, lit by neon signage.";
const NOVEL = ["rain-slick", "neon signage"];
// Dropped because the tags already carry them — enrichment adds, never repeats.
const REDUNDANT = ["woman", "wool coat", "city street", "night"];

export function ProseEnrichmentDemo() {
  const [enabled, setEnabled] = useState(true);
  const caption = enabled ? [...BASE_TAGS, ...NOVEL] : BASE_TAGS;

  return (
    <div className="not-prose my-6 rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">Try it</span>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <span className="font-mono">prose_enrichment</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Toggle prose enrichment"
            onClick={() => setEnabled((v) => !v)}
            className={`relative h-5 w-9 cursor-pointer rounded-full transition-colors ${
              enabled ? "bg-accent-purple" : "bg-border"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                enabled ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
      </div>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
            Prose output (Florence-2)
          </dt>
          <dd className="mt-1 text-foreground/60 italic">{PROSE}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
            Training caption
          </dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {caption.map((t) => (
              <span
                key={t}
                className={`rounded px-2 py-0.5 font-mono text-xs ${
                  NOVEL.includes(t)
                    ? "border border-accent-teal/40 bg-accent-teal/10 text-accent-teal"
                    : "border border-border bg-background text-foreground/90"
                }`}
              >
                {t}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
            {enabled ? "Appended, at low priority" : "Held back"}
          </dt>
          <dd className="mt-1 text-foreground/80">
            {enabled ? (
              <>
                Only the <span className="text-accent-teal">novel</span> phrases are added —{" "}
                <span className="font-mono text-xs">{REDUNDANT.join(", ")}</span> are dropped because
                the tags already carry them. Being last, they are the first tokens a tight budget
                spends.
              </>
            ) : (
              <>
                A pure WD14 tag caption. Nothing from the prose reaches training, so scene context
                like <span className="font-mono text-xs">{NOVEL.join(", ")}</span> is lost.
              </>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
