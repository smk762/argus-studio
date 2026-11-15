/**
 * "Use this variant as final". Lens has no endpoint for it, and a single-image
 * caption writes no sidecar, so the choice lives in the page: it changes what is
 * shown, copied and exported here, and nothing else. Lens's own pick stays in
 * the result, so the choice can be undone and exports can name both.
 */

import type { CaptionResult } from "@/types";

/** The choice worth keeping: null for lens's own pick, and for a missing or empty variant. */
export function finalChoice(result: CaptionResult, variant: string | null): string | null {
  if (!variant || variant === result.selected_category) return null;
  return result.caption_variants[variant]?.trim() ? variant : null;
}

/** The result as this page should present it, keeping `final_caption` the text of `selected_category`. */
export function withFinal(result: CaptionResult, variant: string | null): CaptionResult {
  const chosen = finalChoice(result, variant);
  if (!chosen) return result;
  return { ...result, final_caption: result.caption_variants[chosen], selected_category: chosen };
}

export function resultToJSON(result: CaptionResult, imageUrl: string, variant: string | null): string {
  const final = withFinal(result, variant);
  const choice =
    final === result
      ? {}
      : {
          final_choice: {
            variant: final.selected_category,
            lens_selected_category: result.selected_category,
            lens_final_caption: result.final_caption,
          },
        };
  return JSON.stringify({ image_url: imageUrl, ...final, ...choice }, null, 2);
}

/**
 * One CSV cell. Quoted when it holds a comma, quote, CR or LF (RFC 4180). A
 * cell that a spreadsheet would read as a formula (leading `=`, `+`, `-`, `@`,
 * tab or CR) gets a leading `'`, since captions and tags come from a model the
 * image can steer (CSV/formula injection).
 */
export function escapeCSV(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe) || safe !== value) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function resultToCSV(result: CaptionResult, imageUrl: string, variant: string | null): string {
  const final = withFinal(result, variant);
  const headers = [
    "image_url",
    "variant",
    "caption",
    "backend",
    "selected_category",
    "raw_tags",
    "raw_prose",
    "removed_phrases",
    "compaction_notes",
    // Lens's own pick, as resultToJSON's final_choice names it: the columns above
    // show the page's choice, so without these a chosen variant hides lens's.
    "lens_selected_category",
    "lens_final_caption",
  ];

  const rows: string[][] = [
    [
      imageUrl,
      "__final",
      final.final_caption,
      final.backend_name,
      final.selected_category,
      final.raw_tags,
      final.raw_prose,
      final.removed_phrases.join("; "),
      final.compaction_notes.join("; "),
      result.selected_category,
      result.final_caption,
    ],
    ...Object.entries(final.caption_variants).map(([name, caption]) => [
      imageUrl,
      name,
      caption,
      final.backend_name,
      final.selected_category,
      "",
      "",
      "",
      "",
      result.selected_category,
      "",
    ]),
  ];

  return [headers, ...rows].map((row) => row.map(escapeCSV).join(",")).join("\n") + "\n";
}
