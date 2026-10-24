"use client";

import { useState } from "react";
import type { CaptionResult } from "@/types";

interface VariantStyle {
  label: string;
  border: string;
  labelColor: string;
  alias?: boolean;
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
  camera_framing: {
    label: "CAMERA / FRAMING",
    border: "border-l-accent-orange",
    labelColor: "text-accent-orange",
  },
  pose_gaze: {
    label: "POSE / GAZE",
    border: "border-l-accent-amber",
    labelColor: "text-accent-amber",
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
  pose_composition: {
    label: "POSE (legacy alias)",
    border: "border-l-muted",
    labelColor: "text-muted",
    alias: true,
  },
};

const VARIANT_ORDER = [
  "training",
  "training_prose",
  "zeroshot",
  "identity",
  "wardrobe",
  "camera_framing",
  "pose_gaze",
  "setting",
  "lighting",
  "action",
  "pose_composition",
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

function hasOwn(o: object, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, k);
}

export function CaptionVariants({ result }: CaptionVariantsProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showAlias, setShowAlias] = useState(false);

  const derived = result.final_caption;
  const variants = result.caption_variants;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const hideLegacyPoseComposition =
    hasOwn(variants, "camera_framing") && hasOwn(variants, "pose_gaze");

  const sortedEntries = VARIANT_ORDER.filter((k) => {
    if (hideLegacyPoseComposition && k === "pose_composition") return false;
    return k in variants;
  })
    .map((k) => [k, variants[k]] as [string, string])
    .concat(
      Object.entries(variants).filter(
        ([k]) =>
          !VARIANT_ORDER.includes(k) &&
          !(hideLegacyPoseComposition && k === "pose_composition"),
      ),
    );

  const mainEntries = sortedEntries.filter(([k]) => !VARIANT_STYLES[k]?.alias);
  const aliasEntries = sortedEntries.filter(([k]) => VARIANT_STYLES[k]?.alias);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold tracking-widest text-muted uppercase">
        Caption Variants
      </h3>

      {/* Derived training caption — highlighted */}
      <div className="rounded-lg border border-accent-red/30 bg-accent-red/5 p-4 border-l-4 border-l-accent-red">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold tracking-wider text-accent-red">
            DERIVED TRAINING CAPTION
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
      {mainEntries.map(([key, caption]) => {
        const style = getVariantStyle(key);
        return (
          <div
            key={key}
            className={`rounded-lg border border-border bg-surface p-4 border-l-4 ${style.border}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold tracking-wider ${style.labelColor}`}>
                {style.label}
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

      {/* Backward-compat alias — collapsed by default */}
      {aliasEntries.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowAlias((v) => !v)}
            className="text-xs text-muted hover:text-foreground/60 transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>{showAlias ? "▾" : "▸"}</span>
            {showAlias ? "Hide" : "Show"} legacy aliases ({aliasEntries.length})
          </button>
          {showAlias && aliasEntries.map(([key, caption]) => {
            const style = getVariantStyle(key);
            return (
              <div
                key={key}
                className={`mt-2 rounded-lg border border-border/50 bg-surface/50 p-4 border-l-4 ${style.border} opacity-60`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold tracking-wider ${style.labelColor}`}>
                      {style.label}
                    </span>
                    <span className="text-xs bg-border/60 text-muted px-1.5 py-0.5 rounded">
                      camera_framing + pose_gaze
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(caption, key)}
                    className="text-xs text-accent-teal/60 hover:text-accent-teal/80 transition-colors cursor-pointer"
                  >
                    {copiedKey === key ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="text-sm text-foreground/60 leading-relaxed">
                  {caption}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
