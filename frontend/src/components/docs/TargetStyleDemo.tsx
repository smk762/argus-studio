"use client";

import { useState } from "react";
import { DemoCard, DemoFact, DemoFacts, SegmentedButtons } from "@/components/docs/DemoPrimitives";
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
    <DemoCard aside="styles from the Caption tool">

      <SegmentedButtons
        label="Target style"
        options={TARGET_STYLES.map((s) => ({ value: s as string, label: STYLE_LABELS[s] ?? s }))}
        value={style}
        onChange={setStyle}
      />

      {demo ? (
        <DemoFacts>
          <DemoFact term="What it does">{demo.blurb}</DemoFact>
          <DemoFact
            term="Caption shape (example)"
            className="rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground/90"
          >
            {demo.caption}
          </DemoFact>
          <DemoFact term="Base checkpoints it suits">{demo.suits}</DemoFact>
        </DemoFacts>
      ) : (
        // A style the server offers that this page has no worked example for.
        <p className="text-sm text-muted">
          This server offers <span className="font-mono text-accent-teal-ink">{style}</span>. See the
          Caption tool for its output.
        </p>
      )}
    </DemoCard>
  );
}
