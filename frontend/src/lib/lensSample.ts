/**
 * Recorded argus-lens caption for the static demo (lib/staticDemo.ts).
 *
 * Provenance: a real argus-lens 0.10.0 run on the hybrid backend (RAM++ tags +
 * qwen3-vl prose, identity variant refined by qwen3:4b-instruct; see
 * `metadata`), kept verbatim. The source image is a public-domain plate by
 * Richard Knötel (Norway, 1863, from his Uniformenkunde) on Wikimedia Commons;
 * a resized WebP copy ships at `public/demo/lens/knotel-norway-1863.webp`.
 */

import type { CaptionResult } from "@/types";

export const RECORDED_CAPTION: CaptionResult = {
  "final_caption": "soldier, army, officer, horse, man, troop",
  "caption_variants": {
    "identity": "soldier, army, officer, horse, man, troop",
    "wardrobe": "uniform, a group of six soldiers in 1863 uniforms, standing on a hillside in norway, are depicted in a detailed illustration, soldier, army, horse",
    "pose_composition": "the figures are rendered in a realistic style, with the soldiers standing close to each other and in different poses, holding their weapons, soldier",
    "setting": "positioned in a landscape with a horse in the center, behind them, trees and a distant range of hills under a light sky",
    "lighting": "soldier, army, horse, uniform",
    "action": "soldier, army, horse, uniform",
    "training": "uniform, soldier, army, horse, illustration, man, cartoon, officer",
    "training_prose": "A group of six soldiers in 1863 uniforms, standing on a hillside in Norway, are depicted in a detailed illustration. The figures are rendered in a realistic style, with the soldiers standing close to each other and in different poses, holding their weapons.",
    "zeroshot": "the soldiers are arranged in a semi-circle, each in distinct roles: a hunter (jäger), a cavalryman (kavallerist), a musketeer (muskettier), a guard-soldier (garde-schärfschütz), an artilleryman (artillerist), soldier, army, horse, illustration, man, cartoon, officer, troop, war"
  },
  "selected_category": "identity",
  "removed_phrases": [
    "war",
    "conflict",
    "horseback",
    "rifle",
    "weapon",
    "the soldiers are arranged in a semi-circle, each in distinct roles: a hunter (jäger), a cavalryman (kavallerist), a musketeer (muskettier), a guard-soldier (garde-schärfschütz), and an artilleryman (artillerist)",
    "the illustration has a clear, precise rendering, with the title \"norwegen\" at the top, and the artist’s signature at the bottom right",
    "the figures are rendered in a realistic style, with the soldiers standing close to each other and in different poses, holding their weapons",
    "a group of six soldiers in 1863 uniforms, standing on a hillside in norway, are depicted in a detailed illustration",
    "the uniforms feature various colors and detailed insignia, including red, blue, green, and yellow, with textures and details like buttons, sashes, and swords that are clearly visible",
    "uniform",
    "positioned in a landscape with a horse in the center, and behind them, trees and a distant range of hills under a light sky",
    "illustration",
    "man",
    "cartoon",
    "officer",
    "troop",
    "army",
    "horse",
    "soldier",
    "the soldiers are arranged in a semi-circle, each in distinct roles: a hunter (jäger), a cavalryman (kavallerist), a musketeer (muskettier), a guard-soldier (garde-schärfschütz), and an artilleryman (artillerist).",
    "they are positioned in a landscape with a horse in the center, and behind them, trees and a distant range of hills under a light sky.",
    "blue",
    "green",
    "sashes",
    "the uniforms feature various colors and detailed insignia, including red and yellow, with textures and details like buttons, and swords that are clearly visible.",
    "the illustration has a clear, precise rendering, with the title \"norwegen\" at the top, and the artist’s signature at the bottom right."
  ],
  "compaction_notes": [
    "Trimmed lower-priority fragments to keep captions compact.",
    "Repaired disjointed fragments in assembled captions.",
    "Refined identity with qwen3:4b-instruct."
  ],
  "raw_tags": "soldier, army, horse, uniform, illustration, man, cartoon, officer, troop, war, conflict, horseback, rifle, weapon",
  "raw_prose": "A group of six soldiers in 1863 uniforms, standing on a hillside in Norway, are depicted in a detailed illustration. The soldiers are arranged in a semi-circle, each in distinct roles: a hunter (Jäger), a cavalryman (Kavallerist), a musketeer (Muskettier), a guard-soldier (Garde-Schärfschütz), and an artilleryman (Artillerist). They are positioned in a landscape with a horse in the center, and behind them, trees and a distant range of hills under a light sky. The uniforms feature various colors and detailed insignia, including red, blue, green, and yellow, with textures and details like buttons, sashes, and swords that are clearly visible. The figures are rendered in a realistic style, with the soldiers standing close to each other and in different poses, holding their weapons. The illustration has a clear, precise rendering, with the title \"Norwegen\" at the top, and the artist’s signature at the bottom right.",
  "backend_name": "hybrid",
  "metadata": {
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
          "a group of six soldiers in 1863 uniforms, standing on a hillside in norway, are depicted in a detailed illustration",
          "the uniforms feature various colors and detailed insignia, including red, blue, green, and yellow, with textures and details like buttons, sashes, and swords that are clearly visible"
        ],
        "pose_composition": [
          "the figures are rendered in a realistic style, with the soldiers standing close to each other and in different poses, holding their weapons"
        ],
        "setting": [
          "positioned in a landscape with a horse in the center, and behind them, trees and a distant range of hills under a light sky"
        ],
        "lighting": [],
        "action": [],
        "unclassified": [
          "the soldiers are arranged in a semi-circle, each in distinct roles: a hunter (jäger), a cavalryman (kavallerist), a musketeer (muskettier), a guard-soldier (garde-schärfschütz), and an artilleryman (artillerist)",
          "the illustration has a clear, precise rendering, with the title \"norwegen\" at the top, and the artist’s signature at the bottom right"
        ]
      }
    },
    "subjects": {
      "count": null,
      "multiple": false,
      "tag_count": null,
      "prose_count": null,
      "agree": null,
      "evidence": []
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
    "lens_version": "0.10.0",
    "backend": "hybrid:ram+openai-compat",
    "tag_model": "RAM++ (ram_plus_swin_large_14m)",
    "prose_model": "qwen3-vl:2b-instruct (prompt: straightforward)",
    "refine_model": "qwen3:4b-instruct (identity variant)",
    "device": "cpu",
    "image": "lens-sample-pd.jpg",
    "source": {
      "title": "Norwegen 1863 Jäger Kavallerist Musketier Garde-Scharfschütz Artillerist. Uniformenkunde military uniform plate print by Richard Knötel (1857-1914) publ in 1890s? Norwegian army cavalry guards artillery PD-old.jpg",
      "author": "Richard Knötel",
      "license": "PD",
      "source_url": "https://commons.wikimedia.org/wiki/File:Norwegen_1863_J%C3%A4ger_Kavallerist_Musketier_Garde-Scharfsch%C3%BCtz_Artillerist._Uniformenkunde_military_uniform_plate_print_by_Richard_Kn%C3%B6tel_(1857-1914)_publ_in_1890s%3F_Norwegian_army_cavalry_guards_artillery_PD-old.jpg"
    }
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
