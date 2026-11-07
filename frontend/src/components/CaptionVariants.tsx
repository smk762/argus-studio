"use client";

import { useState } from "react";
import { finalChoice, withFinal } from "@/lib/captionFinal";
import { refineOf } from "@/lib/captionRefine";
import { isT5Backend, tokenBudget, tokenUse } from "@/lib/captionTokens";
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
    border: "border-l-accent-yellow",
    labelColor: "text-accent-yellow",
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
  /** Lens's result, untouched. */
  result: CaptionResult;
  /** The target backend this result was sized for, which is not always the dropdown's. */
  backend: string;
  budgets: Record<string, number>;
  /** A variant chosen as final on this page; null keeps lens's pick. */
  finalVariant: string | null;
  onChooseFinal: (variant: string | null) => void;
}

function TokenCount({ text, backend, budgets }: { text: string; backend: string; budgets: Record<string, number> }) {
  if (!text.trim()) return null;
  const { used, budget, over } = tokenUse(text, backend, budgets);
  return (
    <span
      title={over ? `Tokens past the budget may never reach ${backend}'s text encoder.` : undefined}
      className={`font-mono text-[11px] tabular-nums ${over ? "font-semibold text-accent-amber" : "text-muted"}`}
    >
      about {used} / {budget} tokens{over && " · over budget"}
    </span>
  );
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

export function CaptionVariants({ result, backend, budgets, finalVariant, onChooseFinal }: CaptionVariantsProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const final = withFinal(result, finalVariant);
  const chosen = final !== result;
  const derived = final.final_caption;
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
      <p className="text-xs text-muted">
        Budget for <span className="font-mono">{backend}</span>:{" "}
        {`${tokenBudget(backend, budgets)} tokens. Counts are lens's word-based ${isT5Backend(backend) ? "T5" : "CLIP"} estimate, not a tokenizer's, so treat them as approximate.`}
      </p>

      {/* Derived training caption — highlighted */}
      <div className="rounded-lg border border-accent-red/30 bg-accent-red/5 p-4 border-l-4 border-l-accent-red">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-2 text-xs font-bold tracking-wider text-accent-red">
            {chosen ? `FINAL CAPTION: ${getVariantStyle(final.selected_category).label}` : "DERIVED TRAINING CAPTION"}
            {rewritten.has(final.selected_category) && <RewrittenBadge model={refine?.model ?? ""} />}
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
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <TokenCount text={derived} backend={backend} budgets={budgets} />
          {chosen && (
            <button
              onClick={() => onChooseFinal(null)}
              className="text-xs text-accent-teal hover:text-accent-teal/80 transition-colors cursor-pointer"
            >
              Back to lens&apos;s pick ({getVariantStyle(result.selected_category).label})
            </button>
          )}
        </div>
        {chosen && (
          <p className="mt-2 text-xs text-muted">
            Your choice, on this page only. Copy and the JSON and CSV exports use it. Nothing was sent to lens, and
            re-captioning or reloading clears it.
          </p>
        )}
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
              <span className="flex items-center gap-3">
                {key === final.selected_category ? (
                  <span className="text-xs text-muted">Final</span>
                ) : (
                  (finalChoice(result, key) || key === result.selected_category) && (
                    <button
                      onClick={() => onChooseFinal(key)}
                      className="text-xs text-accent-teal hover:text-accent-teal/80 transition-colors cursor-pointer"
                    >
                      Use as final
                    </button>
                  )
                )}
                <button
                  onClick={() => handleCopy(caption, key)}
                  className="text-xs text-accent-teal hover:text-accent-teal/80 transition-colors cursor-pointer"
                >
                  {copiedKey === key ? "Copied!" : "Copy to clipboard"}
                </button>
              </span>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {caption}
            </p>
            <div className="mt-2">
              <TokenCount text={caption} backend={backend} budgets={budgets} />
            </div>
          </div>
        );
      })}

    </div>
  );
}
