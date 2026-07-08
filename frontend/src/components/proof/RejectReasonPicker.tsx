"use client";

import { REJECT_TAXONOMY, type RejectReasonCode } from "@/lib/proofApi";

/**
 * The structured, multi-label reject taxonomy — the closed vocabulary from the
 * proof wire contract surfaced as toggle chips. Captured as structured codes
 * (not free text) so failure modes stay attributable to configs downstream.
 */
interface RejectReasonPickerProps {
  selected: RejectReasonCode[];
  onToggle: (code: RejectReasonCode) => void;
  disabled?: boolean;
}

export function RejectReasonPicker({ selected, onToggle, disabled = false }: RejectReasonPickerProps) {
  const active = new Set(selected);
  return (
    <div className="flex flex-wrap gap-1">
      {REJECT_TAXONOMY.map((r) => {
        const on = active.has(r.code);
        return (
          <button
            key={r.code}
            type="button"
            disabled={disabled}
            title={r.hint}
            aria-pressed={on}
            onClick={() => onToggle(r.code)}
            className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors disabled:opacity-40 ${
              on
                ? "border-accent-red/50 bg-accent-red/15 text-accent-red"
                : "border-border bg-surface text-muted hover:border-accent-red/30 hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
