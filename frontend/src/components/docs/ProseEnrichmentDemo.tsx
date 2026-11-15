"use client";

import { useState } from "react";
import { DemoCard, DemoFact, DemoFacts, ToggleSwitch } from "@/components/docs/DemoPrimitives";

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
    <DemoCard
      aside={
        <ToggleSwitch
          checked={enabled}
          onChange={setEnabled}
          label={<span className="font-mono">prose_enrichment</span>}
          ariaLabel="Toggle prose enrichment"
        />
      }
    >

      <DemoFacts>
        <DemoFact term="Prose output (Florence-2)" className="text-muted italic">
          {PROSE}
        </DemoFact>
        <DemoFact term="Training caption" className="flex flex-wrap gap-1.5">
            {caption.map((t) => (
              <span
                key={t}
                className={`rounded px-2 py-0.5 font-mono text-xs ${
                  NOVEL.includes(t)
                    ? "border border-accent-teal/40 bg-accent-teal/10 text-accent-teal-ink"
                    : "border border-border bg-background text-foreground/90"
                }`}
              >
                {t}
              </span>
            ))}
        </DemoFact>
        <DemoFact term={enabled ? "Appended, at low priority" : "Held back"}>
            {enabled ? (
              <>
                Only the <span className="text-accent-teal-ink">novel</span> phrases are added —{" "}
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
        </DemoFact>
      </DemoFacts>
    </DemoCard>
  );
}
