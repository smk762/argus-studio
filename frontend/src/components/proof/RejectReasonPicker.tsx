"use client";

import {
  categoryChoices,
  policyLabel,
  POLICY_CATEGORIES,
  REJECT_TAXONOMY,
  unsafeCategories,
  type RejectReason,
  type RejectReasonCode,
} from "@/lib/proofApi";

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

/**
 * Files an `unsafe` reject under proof's policy taxonomy. The gate's own `unsafe`
 * rejects arrive uncategorised, so this is where the category comes from.
 */
export function UnsafeCategoryPicker({
  reasons,
  onToggle,
}: {
  reasons: RejectReason[];
  onToggle: (category: string) => void;
}) {
  const active = new Set(unsafeCategories(reasons));
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Unsafe category">
      <span className="text-[10px] uppercase tracking-wide text-muted">Unsafe as</span>
      {categoryChoices(reasons).map((slug) => {
        const on = active.has(slug);
        return (
          <button
            key={slug}
            type="button"
            title={POLICY_CATEGORIES.find((c) => c.slug === slug)?.hint ?? "Category outside this client's taxonomy"}
            aria-pressed={on}
            onClick={() => onToggle(slug)}
            className={`rounded-md border px-1.5 py-0.5 text-[10px] transition-colors ${
              on
                ? "border-accent-red/50 bg-accent-red/15 text-accent-red"
                : "border-border bg-surface text-muted hover:border-accent-red/30 hover:text-foreground"
            }`}
          >
            {policyLabel(slug)}
          </button>
        );
      })}
    </div>
  );
}
