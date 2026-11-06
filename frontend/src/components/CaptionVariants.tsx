"use client";

import { useState } from "react";
import { refineOf } from "@/lib/captionRefine";
import type { CaptionResult } from "@/types";

interface VariantStyle {
  label: string;
  border: string;
  labelColor: string;
}

const VARIANT_STYLES: Record<string, VariantStyle> = {
  training: {
    label: "TRAINING",
    border: "border-l-accent-red",
    labelColor: "text-accent-red",
  },
  // Sentence-form training caption for T5-encoder models (argus-lens#53):
  // identity removed at the phrase level and sized to the T5 token budget.
  training_prose: {
    label: "TRAINING PROSE (FLUX / SD3)",
    border: "border-l-accent-red/60",
    labelColor: "text-accent-red/80",
  },
  zeroshot: {
    label: "ZERO-SHOT",
    border: "border-l-accent-teal",
    labelColor: "text-accent-teal",
  },
  identity: {
    label: "IDENTITY",
    border: "border-l-accent-purple",
    labelColor: "text-accent-purple",
  },
  wardrobe: {
    label: "WARDROBE",
    border: "border-l-accent-green",
    labelColor: "text-accent-green",
  },
  pose_composition: {
    label: "POSE / COMPOSITION",
    border: "border-l-accent-orange",
    labelColor: "text-accent-orange",
  },
  setting: {
    label: "SETTING",
    border: "border-l-accent-blue",
    labelColor: "text-accent-blue",
  },
  lighting: {
    label: "LIGHTING",
    border: "border-l-amber-300",
    labelColor: "text-amber-300",
  },
  action: {
    label: "ACTION",
    border: "border-l-accent-pink",
    labelColor: "text-accent-pink",
  },
};

const VARIANT_ORDER = [
  "training",
  "training_prose",
  "zeroshot",
  "identity",
  "wardrobe",
  "pose_composition",
  "setting",
  "lighting",
  "action",
];

function getVariantStyle(key: string): VariantStyle {
  return (
    VARIANT_STYLES[key] ?? {
      label: key.toUpperCase().replace(/_/g, " "),
      border: "border-l-muted",
      labelColor: "text-muted",
    }
  );
}

interface CaptionVariantsProps {
  result: CaptionResult;
}

function RewrittenBadge({ model }: { model: string }) {
  return (
    <span
      title={model ? `Rewritten by ${model}` : "Rewritten by an LLM"}
      className="rounded border border-accent-teal/40 px-1.5 py-px text-[10px] font-semibold tracking-wider text-accent-teal"
    >
      LLM
    </span>
  );
}

export function CaptionVariants({ result }: CaptionVariantsProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const derived = result.final_caption;
  const variants = result.caption_variants;
  const refine = refineOf(result.metadata);
  const rewritten = new Set(refine?.accepted ?? []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // Known variants in lens's order, then anything newer this client has no style for.
  const entries = VARIANT_ORDER.filter((k) => k in variants)
    .map((k) => [k, variants[k]] as [string, string])
    .concat(Object.entries(variants).filter(([k]) => !VARIANT_ORDER.includes(k)));

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold tracking-widest text-muted uppercase">
        Caption Variants
      </h3>

      {/* Derived training caption — highlighted */}
      <div className="rounded-lg border border-accent-red/30 bg-accent-red/5 p-4 border-l-4 border-l-accent-red">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-2 text-xs font-bold tracking-wider text-accent-red">
            DERIVED TRAINING CAPTION
            {rewritten.has(result.selected_category) && <RewrittenBadge model={refine?.model ?? ""} />}
          </span>
          <button
            onClick={() => handleCopy(derived, "__derived")}
            className="text-xs text-accent-teal hover:text-accent-teal/80 transition-colors cursor-pointer"
          >
            {copiedKey === "__derived" ? "Copied!" : "Copy to clipboard"}
          </button>
        </div>
        <p className="text-sm text-foreground/90 font-mono leading-relaxed">
          {derived}
        </p>
      </div>

      {/* Category variants */}
      {entries.map(([key, caption]) => {
        const style = getVariantStyle(key);
        return (
          <div
            key={key}
            className={`rounded-lg border border-border bg-surface p-4 border-l-4 ${style.border}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`flex items-center gap-2 text-xs font-bold tracking-wider ${style.labelColor}`}>
                {style.label}
                {rewritten.has(key) && <RewrittenBadge model={refine?.model ?? ""} />}
              </span>
              <button
                onClick={() => handleCopy(caption, key)}
                className="text-xs text-accent-teal hover:text-accent-teal/80 transition-colors cursor-pointer"
              >
                {copiedKey === key ? "Copied!" : "Copy to clipboard"}
              </button>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {caption}
            </p>
          </div>
        );
      })}

    </div>
  );
}
