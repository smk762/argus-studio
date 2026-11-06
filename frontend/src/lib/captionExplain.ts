/**
 * How lens assembled a caption, from what it already sends: each raw fragment
 * is classified into `metadata.buckets`, then a variant keeps what fits it.
 * Whether a fragment survived is read off the variant's text, because
 * `removed_phrases` lists anything dropped from any variant and so over-reports
 * for a single one.
 */

import type { CaptionResult } from "@/types";

export interface CaptionBuckets {
  tags: Record<string, string[]>;
  prose: Record<string, string[]>;
}

export interface TracedFragment {
  text: string;
  source: "tags" | "prose";
  category: string;
  kept: boolean;
}

export interface CaptionTrace {
  /** Raw tags that reached no category: rating and meta tags lens strips as training noise. */
  stripped: string[];
  fragments: TracedFragment[];
}

const UNCLASSIFIED = "unclassified";

const normalize = (value: string) => value.toLowerCase().replace(/_/g, " ").trim();

function bucketSide(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([category, items]) =>
      Array.isArray(items) ? [[category, items.filter((item): item is string => typeof item === "string")]] : [],
    ),
  );
}

/** `metadata` is an untyped bag, and a lens release without buckets has nothing to explain. */
export function bucketsOf(metadata: Record<string, unknown> | null | undefined): CaptionBuckets | null {
  const raw = metadata?.buckets;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { tags, prose } = raw as Record<string, unknown>;
  const buckets = { tags: bucketSide(tags), prose: bucketSide(prose) };
  const empty = [...Object.values(buckets.tags), ...Object.values(buckets.prose)].every((items) => items.length === 0);
  return empty ? null : buckets;
}

export function splitTags(raw: string): string[] {
  return raw.split(",").map(normalize).filter(Boolean);
}

/** Categories that hold anything, in lens's order, with `unclassified` last. */
export function bucketCategories(buckets: CaptionBuckets): string[] {
  const filled = [...Object.entries(buckets.tags), ...Object.entries(buckets.prose)]
    .filter(([, items]) => items.length > 0)
    .map(([category]) => category);
  const unique = [...new Set(filled)];
  return [...unique.filter((category) => category !== UNCLASSIFIED), ...unique.filter((c) => c === UNCLASSIFIED)];
}

const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char);

/** Whole words only: `red` is not in `bored`. */
function appearsIn(text: string, fragment: string): boolean {
  for (let at = text.indexOf(fragment); at !== -1; at = text.indexOf(fragment, at + 1)) {
    if (!isWordChar(text[at - 1]) && !isWordChar(text[at + fragment.length])) return true;
  }
  return false;
}

export function traceVariant(result: CaptionResult, buckets: CaptionBuckets, variant: string): CaptionTrace {
  const text = normalize(result.caption_variants[variant] ?? "");
  const bucketed = new Set<string>();
  const fragments: TracedFragment[] = [];
  for (const source of ["tags", "prose"] as const) {
    for (const [category, items] of Object.entries(buckets[source])) {
      for (const item of items) {
        const fragment = normalize(item);
        if (!fragment) continue;
        if (source === "tags") bucketed.add(fragment);
        fragments.push({ text: item, source, category, kept: appearsIn(text, fragment) });
      }
    }
  }
  const stripped = splitTags(result.raw_tags).filter((tag) => !bucketed.has(tag));
  return { stripped: [...new Set(stripped)], fragments };
}
