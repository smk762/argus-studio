import { refineOf, refineOutcome, type RefineOutcome } from "@/lib/captionRefine";
import type { CaptionResult } from "@/types";

const HEADLINE: Record<RefineOutcome, string> = {
  refined: "LLM rewrite applied",
  partial: "LLM rewrite partly applied",
  failed: "LLM rewrite failed",
  skipped: "LLM rewrite skipped",
  unchanged: "LLM rewrite changed nothing",
};

const label = (variant: string) => variant.replace(/_/g, " ");

/**
 * What lens's LLM rewrite did to this caption. Lens refines by default, so a
 * deterministic caption here usually means the rewrite failed or never ran, and
 * that is worth saying: the variants below look the same either way.
 */
export function RefinementRecord({ result }: { result: CaptionResult }) {
  const record = refineOf(result.metadata);
  if (!record) return null;

  const outcome = refineOutcome(record);
  const fine = outcome === "refined" || outcome === "unchanged";
  const tone = fine
    ? "border-border bg-surface text-muted"
    : "border-accent-amber/40 bg-accent-amber/5 text-accent-amber-ink";
  const rejected = Object.entries(record.rejected);

  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${tone}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold tracking-wider uppercase">{HEADLINE[outcome]}</span>
        {record.model && <span className="font-mono text-[11px] text-muted">{record.model}</span>}
        {record.attempts != null && (
          <span className="font-mono text-[11px] text-muted">
            {record.attempts} {record.attempts === 1 ? "attempt" : "attempts"}
          </span>
        )}
      </div>
      {record.skipped && (
        <p className="mt-1 text-[11px] leading-relaxed">
          {record.skipped === "unavailable"
            ? "The rewrite endpoint was unreachable, so these are the deterministic captions."
            : `Skipped: ${record.skipped}. These are the deterministic captions.`}
        </p>
      )}
      {record.accepted.length > 0 && (
        <p className="mt-1 text-[11px] leading-relaxed text-muted">Rewritten: {record.accepted.map(label).join(", ")}</p>
      )}
      {record.error && <p className="mt-1 font-mono text-[11px] leading-relaxed break-words">{record.error}</p>}
      {rejected.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[11px]">
            {rejected.length} {rejected.length === 1 ? "variant" : "variants"} kept deterministic
          </summary>
          <ul className="mt-1 space-y-1">
            {rejected.map(([variant, problems]) => (
              <li key={variant} className="text-[11px] leading-relaxed">
                <span className="font-semibold">{label(variant)}:</span> {problems.join("; ") || "no reason given"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
