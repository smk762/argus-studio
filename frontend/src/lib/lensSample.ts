/**
 * Recorded argus-lens caption for the static demo (lib/staticDemo.ts).
 *
 * Provenance: a real argus-lens 0.14.1.dev9+g61d8c16 run (its `dev` HEAD,
 * recorded 2026-11-20) of `argus-lens caption -b hybrid:ram+openai-compat
 * --prompt straightforward --refine-variants identity`: RAM++ tags on CUDA
 * (under an argus-iris `caption` lease), qwen3-vl:2b-instruct prose and the
 * identity variant refined by qwen3:4b-instruct, both from Ollama on CPU. The
 * result is kept verbatim, less the `name` the JSON exporter adds; only the
 * recording fields at the end of `metadata` (from `recorded` on) are Studio's.
 * The source image is a public-domain plate by Richard Knötel (Norway, 1863,
 * from his Uniformenkunde) on Wikimedia Commons, captioned at its full
 * 1537x2048; a resized WebP copy ships at `public/demo/lens/knotel-norway-1863.webp`.
 */

import type { CaptionResult } from "@/types";

export const RECORDED_CAPTION: CaptionResult = {
  "final_caption": "soldier, man, officer, army, troop",
  "caption_variants": {
    "identity": "soldier, man, officer, army, troop",
    "wardrobe": "uniform, a group of soldiers in 1863 uniforms standing and a soldier mounted on a horse in a field, soldier, army, horse",
    "pose_composition": "soldier, army, horse, uniform, in the background, there are trees and a hill with mountains",
    "setting": "in the background, there are trees and a hill with mountains, soldier, army, horse, uniform",
    "lighting": "soldier, army, horse, uniform, in the background, there are trees and a hill with mountains",
    "action": "soldier, army, horse, uniform, in the background, there are trees and a hill with mountains",
    "training": "uniform, soldier, army, horse, illustration, man, cartoon, officer",
    "training_prose": "A group of soldiers in 1863 uniforms standing and a soldier mounted on a horse in a field. The soldiers are dressed in various military attire, with some in dark green jackets with red trim and others in blue uniforms with red borders and gold trim.",
    "zeroshot": "the illustration is detailed with clear lines and a color palette of earth tones, blues, reds, a watermark of the artist's name is visible, soldier, army, horse, illustration, man, cartoon, officer, troop, war"
  },
  "selected_category": "identity",
  "removed_phrases": [
    "war",
    "conflict",
    "horseback",
    "rifle",
    "weapon",
    "the illustration is detailed with clear lines and a color palette of earth tones, blues, and reds, and a watermark of the artist's name is visible",
    "a group of soldiers in 1863 uniforms standing and a soldier mounted on a horse in a field",
    "the soldiers are dressed in various military attire, with some in dark green jackets with red trim and others in blue uniforms with red borders and gold trim",
    "holding rifles, and one soldier is equipped with a backpack",
    "uniform",
    "in the background, there are trees and a hill with mountains",
    "illustration",
    "man",
    "cartoon",
    "officer",
    "troop",
    "soldier",
    "army",
    "horse",
    "they are holding rifles, and one soldier is equipped with a backpack.",
    "in the background, there are trees and a hill with mountains.",
    "the illustration is detailed with clear lines and a color palette of earth tones, blues, and reds, and a watermark of the artist's name is visible."
  ],
  "compaction_notes": [
    "Trimmed lower-priority fragments to keep captions compact.",
    "Repaired disjointed fragments in assembled captions.",
    "Refined identity with qwen3:4b-instruct."
  ],
  "raw_tags": "soldier, army, horse, uniform, illustration, man, cartoon, officer, troop, war, conflict, horseback, rifle, weapon",
  "raw_prose": "A group of soldiers in 1863 uniforms standing and a soldier mounted on a horse in a field. The soldiers are dressed in various military attire, with some in dark green jackets with red trim and others in blue uniforms with red borders and gold trim. They are holding rifles, and one soldier is equipped with a backpack. In the background, there are trees and a hill with mountains. The illustration is detailed with clear lines and a color palette of earth tones, blues, and reds, and a watermark of the artist's name is visible.",
  "backend_name": "hybrid",
  "metadata": {
    "empty_categories": [
      "pose_composition",
      "lighting",
      "action"
    ],
    "buckets": {
      "tags": {
        "identity": [],
        "wardrobe": [
          "uniform"
        ],
        "pose_composition": [],
        "setting": [],
        "lighting": [],
        "action": [],
        "unclassified": [
          "soldier",
          "army",
          "horse",
          "illustration",
          "man",
          "cartoon",
          "officer",
          "troop",
          "war",
          "conflict",
          "horseback",
          "rifle",
          "weapon"
        ]
      },
      "prose": {
        "identity": [],
        "wardrobe": [
          "a group of soldiers in 1863 uniforms standing and a soldier mounted on a horse in a field",
          "the soldiers are dressed in various military attire, with some in dark green jackets with red trim and others in blue uniforms with red borders and gold trim",
          "holding rifles, and one soldier is equipped with a backpack"
        ],
        "pose_composition": [],
        "setting": [
          "in the background, there are trees and a hill with mountains"
        ],
        "lighting": [],
        "action": [],
        "unclassified": [
          "the illustration is detailed with clear lines and a color palette of earth tones, blues, and reds, and a watermark of the artist's name is visible"
        ]
      }
    },
    "subjects": {
      "count": 3,
      "multiple": true,
      "tag_count": null,
      "prose_count": 3,
      "agree": null,
      "evidence": [
        "group of soldiers"
      ]
    },
    "monochrome": false,
    "reconciled_tags": "soldier, army, horse, uniform, illustration, man, cartoon, officer, troop, war, conflict, horseback, rifle, weapon",
    "tag_reconcile": {
      "dropped": [],
      "added": [],
      "notes": []
    },
    "refine": {
      "rewriter": "openai-compat",
      "model": "qwen3:4b-instruct",
      "accepted": [
        "identity"
      ],
      "rejected": {},
      "attempts": 1
    },
    "recorded": true,
    "lens_version": "0.14.1.dev9+g61d8c16",
    "backend": "hybrid:ram+openai-compat",
    "tag_model": "RAM++ (ram_plus_swin_large_14m)",
    "prose_model": "qwen3-vl:2b-instruct (prompt: straightforward)",
    "refine_model": "qwen3:4b-instruct (identity variant)",
    "device": "cuda",
    "image": "lens-sample-pd.jpg",
    "source": {
      "title": "Norwegen 1863 Jäger Kavallerist Musketier Garde-Scharfschütz Artillerist. Uniformenkunde military uniform plate print by Richard Knötel (1857-1914) publ in 1890s? Norwegian army cavalry guards artillery PD-old.jpg",
      "author": "Richard Knötel",
      "license": "PD",
      "source_url": "https://commons.wikimedia.org/wiki/File:Norwegen_1863_J%C3%A4ger_Kavallerist_Musketier_Garde-Scharfsch%C3%BCtz_Artillerist._Uniformenkunde_military_uniform_plate_print_by_Richard_Kn%C3%B6tel_(1857-1914)_publ_in_1890s%3F_Norwegian_army_cavalry_guards_artillery_PD-old.jpg"
    },
    "lens_commit": "61d8c16a6",
    "recorded_at": "2026-11-20"
  }
};

/** The captioned image, as shipped with the static demo. */
export const RECORDED_CAPTION_IMAGE = {
  src: "/demo/lens/knotel-norway-1863.webp",
  width: 901,
  height: 1200,
  alt:
    "Hand-coloured uniform plate titled Norwegen, 1863: five Norwegian soldiers (Jäger, Kavallerist, " +
    "Musketier, Garde-Scharfschütz, Artillerist) on a grassy hillside, the cavalryman mounted, fir trees behind.",
  attribution: "Richard Knötel, Norway 1863 (Uniformenkunde), public domain, via Wikimedia Commons",
  sourceUrl:
    "https://commons.wikimedia.org/wiki/File:Norwegen_1863_J%C3%A4ger_Kavallerist_Musketier_Garde-Scharfsch%C3%BCtz_Artillerist._Uniformenkunde_military_uniform_plate_print_by_Richard_Kn%C3%B6tel_(1857-1914)_publ_in_1890s%3F_Norwegian_army_cavalry_guards_artillery_PD-old.jpg",
} as const;
