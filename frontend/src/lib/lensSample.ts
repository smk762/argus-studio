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
 * The source image is "Colour celebration in Holi festival" by Avra10 (2019,
 * a Wiki Loves Folklore 2024 winner) on Wikimedia Commons, CC BY-SA 4.0,
 * captioned at its full 1920x1372; a resized WebP copy (1200x858, under the
 * same licence) ships at `public/demo/lens/holi-festival-2019.webp`.
 */

import type { CaptionResult } from "@/types";

export const RECORDED_CAPTION: CaptionResult = {
  "final_caption": "person, powder, celebration",
  "caption_variants": {
    "identity": "person, powder, celebration",
    "wardrobe": "festival, person, powder, some are bent, reaching out, others are standing with arms raised",
    "pose_composition": "some are bent, reaching out, others are standing with arms raised, festival, person, powder",
    "setting": "festival, person, powder, some are bent, reaching out, others are standing with arms raised",
    "lighting": "festival, person, powder, some are bent, reaching out, others are standing with arms raised",
    "action": "a high-angle view captures a vibrant holi festival scene, focusing on a central figure holding a white bucket, from which a thick stream of yellow-colored powder erupts upward, striking a dense crowd of people",
    "training": "festival, person, powder, celebration, color, crowd, throw, blanket",
    "training_prose": "A high-angle view captures a vibrant Holi festival scene, focusing on a central figure holding a white bucket, from which a thick stream of yellow-colored powder erupts upward, striking a dense crowd of people.",
    "zeroshot": "the ground is obscured by the falling powder, creating a dynamic visual effect as the particles rise against the backdrop of a crowd of people, filled with a riot of color, with the red and orange hues of the festival dominating the visual landscape"
  },
  "selected_category": "identity",
  "removed_phrases": [
    "celebrate",
    "spray",
    "liquid",
    "flare",
    "crowded",
    "the individuals, many with their heads covered in a mix of red and other colored powders, are tightly packed in a circular formation",
    "the ground is obscured by the falling powder, creating a dynamic visual effect as the particles rise against the backdrop of a crowd of people",
    "filled with a riot of color, with the red and orange hues of the festival dominating the visual landscape",
    "some are bent over, reaching out, and others are standing with arms raised",
    "a high-angle view captures a vibrant holi festival scene, focusing on a central figure holding a white bucket, from which a thick stream of yellow-colored powder erupts upward, striking a dense crowd of people",
    "celebration",
    "color",
    "crowd",
    "throw",
    "blanket",
    "festival",
    "person",
    "powder",
    "the individuals, many with their heads covered in a mix of red and other colored powders, are tightly packed in a circular formation.",
    "some are bent over, reaching out, and others are standing with arms raised.",
    "the ground is obscured by the falling powder, creating a dynamic visual effect as the particles rise against the backdrop of a crowd of people.",
    "filled with a riot of color, with the red and orange hues of the festival dominating the visual landscape."
  ],
  "compaction_notes": [
    "Normalised prose (opener).",
    "Trimmed lower-priority fragments to keep captions compact.",
    "Repaired disjointed fragments in assembled captions.",
    "Refined identity with qwen3:4b-instruct."
  ],
  "raw_tags": "festival, person, powder, celebration, color, crowd, throw, blanket, celebrate, spray, liquid, flare, crowded",
  "raw_prose": "A high-angle view captures a vibrant Holi festival scene, focusing on a central figure holding a white bucket, from which a thick stream of yellow-colored powder erupts upward, striking a dense crowd of people. The individuals, many with their heads covered in a mix of red and other colored powders, are tightly packed in a circular formation. Some are bent over, reaching out, and others are standing with arms raised. The ground is obscured by the falling powder, creating a dynamic visual effect as the particles rise against the backdrop of a crowd of people. The scene is filled with a riot of color, with the red and orange hues of the festival dominating the visual landscape.",
  "backend_name": "hybrid",
  "metadata": {
    "empty_categories": [
      "wardrobe",
      "setting",
      "lighting"
    ],
    "buckets": {
      "tags": {
        "identity": [],
        "wardrobe": [],
        "pose_composition": [],
        "setting": [],
        "lighting": [],
        "action": [],
        "unclassified": [
          "festival",
          "person",
          "powder",
          "celebration",
          "color",
          "crowd",
          "throw",
          "blanket",
          "celebrate",
          "spray",
          "liquid",
          "flare",
          "crowded"
        ]
      },
      "prose": {
        "identity": [],
        "wardrobe": [],
        "pose_composition": [
          "some are bent over, reaching out, and others are standing with arms raised"
        ],
        "setting": [],
        "lighting": [],
        "action": [
          "a high-angle view captures a vibrant holi festival scene, focusing on a central figure holding a white bucket, from which a thick stream of yellow-colored powder erupts upward, striking a dense crowd of people"
        ],
        "unclassified": [
          "the individuals, many with their heads covered in a mix of red and other colored powders, are tightly packed in a circular formation",
          "the ground is obscured by the falling powder, creating a dynamic visual effect as the particles rise against the backdrop of a crowd of people",
          "filled with a riot of color, with the red and orange hues of the festival dominating the visual landscape"
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
        "crowd of people",
        "crowd of people"
      ]
    },
    "monochrome": false,
    "reconciled_tags": "festival, person, powder, celebration, color, crowd, throw, blanket, celebrate, spray, liquid, flare, crowded",
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
    "image": "holi.jpg",
    "source": {
      "title": "Colour celebration in Holi festival.jpg",
      "author": "Avra10",
      "license": "CC BY-SA 4.0",
      "source_url": "https://commons.wikimedia.org/wiki/File:Colour_celebration_in_Holi_festival.jpg"
    },
    "lens_commit": "61d8c16a6",
    "recorded_at": "2026-11-20"
  }
};

/** The captioned image, as shipped with the static demo. */
export const RECORDED_CAPTION_IMAGE = {
  src: "/demo/lens/holi-festival-2019.webp",
  width: 1200,
  height: 858,
  alt:
    "Seen from above at a Holi festival: a dense crowd covered in red and pink powder, one person tipping a " +
    "white bucket that sends a stream of yellow powder arcing over the heads.",
  attribution: "Avra10, Colour celebration in Holi festival (2019), CC BY-SA 4.0, via Wikimedia Commons (resized)",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Colour_celebration_in_Holi_festival.jpg",
} as const;
