"use client";

import { useState } from "react";
import { TARGET_STYLES } from "@/types";

/**
 * Live, embeddable widget for the Target Style doc page. The style list is the
 * SAME `TARGET_STYLES` constant the Caption tool's picker uses, so a style
 * added to the tool shows up here too.
 *
 * The captions are worked examples, not live output — they exist to show the
 * shape difference (natural-language vs booru tag-style) that the setting
 * actually produces.
 */
const STYLE_LABELS: Record<string, string> = {
  photo: "Photo",
  anime: "Anime",
};

const STYLE_DEMO: Record<string, { blurb: string; caption: string; suits: string }> = {
  photo: {
    blurb: "Natural-language tokens, phrased the way a realism checkpoint was captioned.",
    caption:
      "sks woman, a woman in a charcoal wool coat standing on a rain-slick street at dusk, shallow depth of field, soft rim lighting",
    suits: "SDXL / SD 1.5 realism checkpoints, Flux",
  },
  anime: {
    blurb: "Comma-separated booru tags at higher density — what a tag-trained checkpoint expects.",
    caption:
      "sks_woman, 1girl, solo, wool coat, city street, night, rain, depth_of_field, rim_lighting, cowboy_shot",
    suits: "Pony / Illustrious / NoobAI and other booru-tagged checkpoints",
  },
};

export function TargetStyleDemo() {
  const [style, setStyle] = useState<string>(TARGET_STYLES[0]);
  const demo = STYLE_DEMO[style];

  return (
    <div className="not-prose my-6 rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">Try it</span>
        <span className="text-xs text-muted">styles from the Caption tool</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TARGET_STYLES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStyle(s)}
            aria-pressed={style === s}
            className={
              style === s
                ? "cursor-pointer rounded-lg bg-accent-purple px-3 py-1.5 text-sm font-medium text-white"
                : "cursor-pointer rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-hover"
            }
          >
            {STYLE_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      {demo ? (
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
              What it does
            </dt>
            <dd className="mt-1 text-foreground/80">{demo.blurb}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
              Caption shape (example)
            </dt>
            <dd className="mt-1 rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground/90">
              {demo.caption}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
              Base checkpoints it suits
            </dt>
            <dd className="mt-1 text-foreground/80">{demo.suits}</dd>
          </div>
        </dl>
      ) : (
        // A style the server offers that this page has no worked example for.
        <p className="text-sm text-muted">
          This server offers <span className="font-mono text-accent-teal/90">{style}</span>. See the
          Caption tool for its output.
        </p>
      )}
    </div>
  );
}
