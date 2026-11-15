/**
 * Facets over batch caption results (#118), from lens's per-row category
 * buckets (`include_buckets`, lens ≥ 0.11). Ported from argus-lightbox's
 * `lib/filter.ts`: terms within a category are OR'd, categories are AND'd, and
 * a category's counts apply every *other* category's selection, so picking a
 * term never zeroes its siblings.
 *
 * Facet terms are the **tag** buckets. Prose buckets hold whole sentences, which
 * make poor checkboxes; they stay in the row's metadata.
 */

import type { BatchCaptionRow, CaptionBuckets } from "@/types";
import { TARGET_CATEGORIES } from "@/types";

export type Selection = Record<string, string[]>;

/** The bucket lens files a tag under when no category claims it. Listed last. */
export const UNCLASSIFIED = "unclassified";

const stringLists = (v: unknown): Record<string, string[]> | undefined => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Record<string, string[]> = {};
  for (const [k, list] of Object.entries(v)) {
    if (Array.isArray(list)) out[k] = list.filter((t): t is string => typeof t === "string");
  }
  return out;
};

/** `metadata.buckets` from an untyped caption result, or undefined when it has none. */
export function bucketsOf(metadata: unknown): CaptionBuckets | undefined {
  const raw = (metadata as { buckets?: unknown } | null | undefined)?.buckets;
  if (!raw || typeof raw !== "object") return undefined;
  const { tags, prose } = raw as { tags?: unknown; prose?: unknown };
  const out: CaptionBuckets = { tags: stringLists(tags), prose: stringLists(prose) };
  return out.tags || out.prose ? out : undefined;
}

/** The distinct, lower-cased tag terms `row` carries in `group`. */
export function rowTerms(row: BatchCaptionRow, group: string): string[] {
  const tags = row.metadata?.buckets?.tags?.[group] ?? [];
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

/** Whether any row came back with tag buckets: facets have something to show. */
export function hasBuckets(rows: readonly BatchCaptionRow[]): boolean {
  return rows.some((r) => Object.values(r.metadata?.buckets?.tags ?? {}).some((list) => list.length > 0));
}

/**
 * The categories any row has a tag in: lens's category order first, then any
 * category newer than this client by name, with `unclassified` last.
 */
export function facetGroups(rows: readonly BatchCaptionRow[]): string[] {
  const present = new Set<string>();
  for (const row of rows) {
    for (const [group, list] of Object.entries(row.metadata?.buckets?.tags ?? {})) {
      if (list.some((t) => t.trim())) present.add(group);
    }
  }
  const known = TARGET_CATEGORIES.map((c) => c.value as string).filter((g) => present.has(g));
  const extra = [...present].filter((g) => !known.includes(g) && g !== UNCLASSIFIED).sort();
  return [...known, ...extra, ...(present.has(UNCLASSIFIED) ? [UNCLASSIFIED] : [])];
}

/** A category's label: the client's own, "Other tags" for unclassified, else title case. */
export function groupLabel(group: string): string {
  if (group === UNCLASSIFIED) return "Other tags";
  const known = TARGET_CATEGORIES.find((c) => c.value === group);
  if (known) return known.label;
  return group
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function matchesSelection(row: BatchCaptionRow, selection: Selection, skipGroup?: string): boolean {
  for (const [group, terms] of Object.entries(selection)) {
    if (group === skipGroup || terms.length === 0) continue;
    const have = rowTerms(row, group);
    if (!terms.some((t) => have.includes(t))) return false;
  }
  return true;
}

/** The rows matching every active category (any of its terms). */
export function filterRows<T extends BatchCaptionRow>(rows: readonly T[], selection: Selection): T[] {
  return rows.filter((r) => matchesSelection(r, selection));
}

export interface FacetTerm {
  term: string;
  count: number;
  selected: boolean;
}

/** Terms in `group` with counts under every other active category, most common first. Selected terms stay listed. */
export function facetCounts(rows: readonly BatchCaptionRow[], group: string, selection: Selection): FacetTerm[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!matchesSelection(row, selection, group)) continue;
    for (const term of rowTerms(row, group)) counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  const selected = selection[group] ?? [];
  for (const term of selected) if (!counts.has(term)) counts.set(term, 0);
  return [...counts.entries()]
    .map(([term, count]) => ({ term, count, selected: selected.includes(term) }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
}

export function toggleTerm(selection: Selection, group: string, term: string): Selection {
  const current = selection[group] ?? [];
  const next = current.includes(term) ? current.filter((t) => t !== term) : [...current, term];
  const out = { ...selection };
  if (next.length) out[group] = next;
  else delete out[group];
  return out;
}

export function activeCount(selection: Selection): number {
  return Object.values(selection).reduce((n, terms) => n + terms.length, 0);
}
