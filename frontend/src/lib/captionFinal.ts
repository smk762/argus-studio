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

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
    ]),
  ];

  return [headers, ...rows].map((row) => row.map(escapeCSV).join(",")).join("\n") + "\n";
}
