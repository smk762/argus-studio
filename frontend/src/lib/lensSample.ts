/**
 * Recorded argus-lens caption for the static demo (lib/staticDemo.ts).
 *
 * Provenance: a real argus-lens 0.11.1.dev4+g4804154 run (its `dev` HEAD,
 * recorded 2026-11-14) of `argus-lens caption -b hybrid:ram+openai-compat
 * --prompt straightforward --refine-variants identity`: RAM++ tags on CPU,
 * qwen3-vl:2b-instruct prose and the identity variant refined by
 * qwen3:4b-instruct, both from Ollama. The result is kept verbatim; only the
 * recording fields at the end of `metadata` (from `recorded` on) are Studio's.
 * The source image is a public-domain plate by Richard Knötel (Norway, 1863,
 * from his Uniformenkunde) on Wikimedia Commons, captioned at its full
 * 1537x2048; a resized WebP copy ships at `public/demo/lens/knotel-norway-1863.webp`.
 */

import type { CaptionResult } from "@/types";

export const RECORDED_CAPTION: CaptionResult = {
  "final_caption": "soldier, man, officer, horse, army, troop",
  "caption_variants": {
    "identity": "soldier, man, officer, horse, army, troop",
    "wardrobe": "uniform, a historical illustration from 1863 depicts a group of norwegian soldiers in a field, wearing distinct uniforms in green, blue, red, soldier",
    "pose_composition": "soldier, army, horse, uniform, set outdoors, with a grassy slope and distant trees",
    "setting": "set outdoors, with a grassy slope and distant trees, soldier, army, horse, uniform",
    "lighting": "soldier, army, horse, uniform, set outdoors, with a grassy slope and distant trees",
    "action": "soldier, army, horse, uniform, set outdoors, with a grassy slope and distant trees",
    "training": "uniform, soldier, army, horse, illustration, man, cartoon, officer",
    "training_prose": "A historical illustration from 1863 depicts a group of Norwegian soldiers in a field, wearing distinct uniforms in green, and red. Set outdoors, with a grassy slope and distant trees.",
    "zeroshot": "in the foreground, three soldiers are in formation, one in a blue uniform with a red trim, another in uniform with a long beard, a small figure in the background is an officer, the soldiers are equipped with rifles and bayonets"
  },
  "selected_category": "identity",
  "removed_phrases": [
    "war",
    "conflict",
    "horseback",
    "rifle",
    "weapon",
    "in the foreground, three soldiers are in formation, one in a blue uniform with a red trim, another in uniform with a long beard, and a small figure in the background is an officer",
    "the soldiers are equipped with rifles and bayonets",
    "a colored, line-drawn illustration",
    "a historical illustration from 1863 depicts a group of norwegian soldiers in a field, wearing distinct uniforms in green, blue, and red",
    "a rider on a horse is positioned centrally, with a soldier in a dark green uniform standing to his left, holding a rifle",
    "uniform",
    "the ground is uneven with small stones, and the sky is light with thin clouds",
    "set outdoors, with a grassy slope and distant trees",
    "illustration",
    "man",
    "cartoon",
    "officer",
    "troop",
    "army",
    "horse",
    "soldier",
    "blue",
    "a rider on a horse is positioned centrally, with a soldier in a dark green uniform standing to his left, holding a rifle.",
    "with a long beard",
    "in the foreground, three soldiers are in formation, one in a blue uniform with a red trim, another in uniform, and a small figure in the background is an officer.",
    "the soldiers are equipped with rifles and bayonets.",
    "the ground is uneven with small stones, and the sky is light with thin clouds.",
    "a colored, line-drawn illustration."
  ],
  "compaction_notes": [
    "Normalised prose (hedge, opener).",
    "Trimmed lower-priority fragments to keep captions compact.",
    "Repaired disjointed fragments in assembled captions.",
    "Refined identity with qwen3:4b-instruct."
  ],
  "raw_tags": "soldier, army, horse, uniform, illustration, man, cartoon, officer, troop, war, conflict, horseback, rifle, weapon",
  "raw_prose": "A historical illustration from 1863 depicts a group of Norwegian soldiers in a field, wearing distinct uniforms in green, blue, and red. A rider on a horse is positioned centrally, with a soldier in a dark green uniform standing to his left, holding a rifle. In the foreground, three soldiers are in formation, one in a blue uniform with a red trim, another in uniform with a long beard, and a small figure in the background appears to be an officer. The scene is set outdoors, with a grassy slope and distant trees. The soldiers are equipped with rifles and bayonets; the ground is uneven with small stones, and the sky is light with thin clouds. The image is a colored, line-drawn illustration.",
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
        "identity": [
          "in the foreground, three soldiers are in formation, one in a blue uniform with a red trim, another in uniform with a long beard, and a small figure in the background is an officer"
        ],
        "wardrobe": [
          "a historical illustration from 1863 depicts a group of norwegian soldiers in a field, wearing distinct uniforms in green, blue, and red",
          "a rider on a horse is positioned centrally, with a soldier in a dark green uniform standing to his left, holding a rifle"
        ],
        "pose_composition": [],
        "setting": [
          "set outdoors, with a grassy slope and distant trees",
          "the ground is uneven with small stones, and the sky is light with thin clouds"
        ],
        "lighting": [],
        "action": [],
        "unclassified": [
          "the soldiers are equipped with rifles and bayonets",
          "a colored, line-drawn illustration"
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
    "lens_version": "0.11.1.dev4+g4804154",
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
    },
    "lens_commit": "4804154cc",
    "recorded_at": "2026-11-14"
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
