"use client";

import { useState } from "react";
import { ParamInfo } from "@/components/ParamInfo";
import type { HybridBalanceParams } from "@/lib/lensApi";

/**
 * Hardcoded fallback so the control still renders when GET /profiles is
 * unreachable (offline/demo). Mirrors the lens defaults.
 */
export const FALLBACK_HYBRID_PRESETS: Record<string, number> = {
  tags: 0.2,
  keywords: 0.35,
  balanced: 0.5,
  descriptive: 0.68,
  prose: 0.85,
};

export const FALLBACK_DEFAULT_PRESET = "balanced";

/** Human labels for the known preset keys; unknown keys are title-cased. */
const PRESET_LABELS: Record<string, string> = {
  tags: "Tags",
  keywords: "Keywords",
  balanced: "Balanced",
  descriptive: "Descriptive",
  prose: "Prose",
};

function presetLabel(key: string): string {
  return PRESET_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

/**
 * The user's current tag↔prose balance selection. Exactly one of the two
 * dimensions is "live": a named preset, or (when the advanced slider is used)
 * a continuous prose_bias override.
 */
export interface HybridBalanceValue {
  /** The selected named preset. Always tracked, even while a slider override is active. */
  preset: string;
  /** Non-null when the advanced slider overrides the preset; sent as prose_bias. */
  proseBias: number | null;
}

/**
 * Reduce a selection to the request fields to send: one of hybrid_preset (named
 * stop) or prose_bias (advanced slider override), matching the lens priority.
 */
export function hybridRequestFields(value: HybridBalanceValue): HybridBalanceParams {
  if (value.proseBias != null) return { prose_bias: value.proseBias };
  return { hybrid_preset: value.preset };
}

interface HybridBalanceProps {
  presets: Record<string, number>;
  value: HybridBalanceValue;
  onChange: (value: HybridBalanceValue) => void;
}

/**
 * Preset segmented control (Tags → Keywords → Balanced → Descriptive → Prose)
 * with an Advanced disclosure that reveals a continuous prose_bias slider. Using
 * the slider overrides the named preset; picking a preset clears the override.
 */
export function HybridBalance({ presets, value, onChange }: HybridBalanceProps) {
  const [expanded, setExpanded] = useState(false);

  // Order stops by their numeric prose_bias, tags → prose.
  const ordered = Object.entries(presets).sort((a, b) => a[1] - b[1]);
  const overriding = value.proseBias != null;
  // Effective bias drives the slider position (preset value when not overriding).
  const effectiveBias = value.proseBias ?? presets[value.preset] ?? FALLBACK_HYBRID_PRESETS[value.preset] ?? 0.5;

  const pickPreset = (key: string) => onChange({ preset: key, proseBias: null });
  const setSlider = (v: number) => onChange({ preset: value.preset, proseBias: v });

  // The card, label, and info toggle are the shared ParamInfo affordance used by
  // every other control on the page; only the segmented control + slider are ours.
  return (
    <ParamInfo
      label="Tag ↔ Prose Balance"
      description="Balances how much the final caption leans on booru-style tags versus natural-language prose. Lower = denser tags; higher = flowing description. Presets are named stops; the Advanced slider sends a raw prose_bias (0.0–1.0) that overrides the preset."
      example={overriding ? `prose_bias=${effectiveBias.toFixed(2)}` : `hybrid_preset="${value.preset}"`}
    >
      <div className="w-full space-y-3">
        {/* Preset segmented control */}
        <div role="radiogroup" aria-label="Tag to prose balance preset" className="flex flex-wrap gap-1.5">
          {ordered.map(([key]) => {
            const active = !overriding && value.preset === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pickPreset(key)}
                className={`flex-1 min-w-[4.5rem] px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? "bg-accent-purple text-white"
                    : "bg-background border border-border text-foreground hover:bg-surface-hover"
                }`}
              >
                {presetLabel(key)}
              </button>
            );
          })}
        </div>

        {/* Advanced disclosure → continuous prose_bias slider */}
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="text-xs text-muted hover:text-foreground/70 transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>{expanded ? "▾" : "▸"}</span>
            Advanced
            {overriding && (
              <span className="ml-1 rounded bg-accent-purple/20 px-1.5 py-0.5 font-mono text-accent-purple">
                prose_bias {effectiveBias.toFixed(2)}
              </span>
            )}
          </button>

          {expanded && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-wider text-muted shrink-0">Tags</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={effectiveBias}
                  onChange={(e) => setSlider(Number(e.target.value))}
                  aria-label="Prose bias (0 = pure tags, 1 = full prose)"
                  className="flex-1 accent-accent-purple cursor-pointer"
                />
                <span className="text-[10px] uppercase tracking-wider text-muted shrink-0">Prose</span>
                <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-accent-purple">
                  {effectiveBias.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted">
                {overriding ? (
                  <>
                    Overriding the preset with a continuous prose_bias.{" "}
                    <button
                      type="button"
                      onClick={() => pickPreset(value.preset)}
                      className="text-accent-purple underline decoration-dotted hover:text-accent-purple/80 cursor-pointer"
                    >
                      Snap back to “{presetLabel(value.preset)}”
                    </button>
                  </>
                ) : (
                  <>
                    Drag to fine-tune. This overrides the “{presetLabel(value.preset)}” preset and sends a raw
                    prose_bias value instead.
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </ParamInfo>
  );
}
