/**
 * Lens refines captions with an LLM by default from 0.10, and each caption says
 * what happened in `metadata.refine`. `metadata` is an untyped bag and older
 * lens releases send no record, so anything else reads as no record at all.
 */

export interface RefineRecord {
  rewriter: string;
  model: string;
  /** Variants the rewrite replaced. */
  accepted: string[];
  /** Variants left deterministic, with the problems behind each rewrite. */
  rejected: Record<string, string[]>;
  attempts: number | null;
  error: string | null;
  /** Why no rewrite was tried, e.g. `unavailable` while the endpoint is down. */
  skipped: string | null;
}

export type RefineOutcome = "refined" | "partial" | "failed" | "skipped" | "unchanged";

const text = (value: unknown): string => (typeof value === "string" ? value : "");

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function refineOf(metadata: Record<string, unknown> | null | undefined): RefineRecord | null {
  const raw = metadata?.refine;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const rejected = record.rejected && typeof record.rejected === "object" ? record.rejected : {};
  return {
    rewriter: text(record.rewriter),
    model: text(record.model),
    accepted: strings(record.accepted),
    rejected: Object.fromEntries(Object.entries(rejected).map(([name, problems]) => [name, strings(problems)])),
    attempts: typeof record.attempts === "number" ? record.attempts : null,
    error: text(record.error) || null,
    skipped: text(record.skipped) || null,
  };
}

/** A rewrite that was kept counts first: an error on a retry does not undo it. */
export function refineOutcome(record: RefineRecord): RefineOutcome {
  if (record.skipped) return "skipped";
  const kept = record.accepted.length > 0;
  const lost = Object.keys(record.rejected).length > 0 || record.error !== null;
  if (kept) return lost ? "partial" : "refined";
  return lost ? "failed" : "unchanged";
}
