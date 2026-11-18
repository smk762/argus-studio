"use client";

import { THINKING_NOTES } from "@/lib/curatorGuard";

interface Props {
  /** `/detectors.singguard_thinking_modes`: what this host allows. */
  modes: readonly string[];
  /** `/detectors.singguard_thinking_default`: what a scan naming none runs in. */
  defaultMode: string | null;
  /** The form's choice. Null runs the curator's default. */
  value: string | null;
  /** Why the choice is off (an older curator), or null. */
  reason: string | null;
  disabled: boolean;
  onChange: (mode: string | null) => void;
}

/**
 * Which SingGuard mode the next scan runs in (argus-curator#180). A first pass
 * over a big folder suits fast or cascade; a review pass over a small keep-set
 * suits slow, for a written reason on every frame.
 */
export function GuardThinkingPicker({ modes, defaultMode, value, reason, disabled, onChange }: Props) {
  // A mode Again brought back stays visible, so it can be switched off; guardProblem names it.
  const options = value && !modes.includes(value) ? [...modes, value] : modes;
  const shown = value ?? defaultMode;
  const note = shown ? THINKING_NOTES[shown] : undefined;
  return (
    <div className="space-y-1">
      <label className="block text-[11px] text-muted" htmlFor="guard-thinking">
        Mode
      </label>
      <select
        id="guard-thinking"
        value={value ?? ""}
        disabled={disabled || reason != null}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent-teal/50 focus:outline-none disabled:opacity-50"
      >
        <option value="">{defaultMode ? `Curator default (${defaultMode})` : "Curator default"}</option>
        {options.map((mode) => (
          <option key={mode} value={mode}>
            {mode}
          </option>
        ))}
      </select>
      <p className="text-[11px] leading-snug text-muted">{reason ?? (note ? `${shown}: ${note}.` : null)}</p>
    </div>
  );
}
