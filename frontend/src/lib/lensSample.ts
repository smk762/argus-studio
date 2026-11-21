/**
 * Recorded argus-lens caption for the static demo (lib/staticDemo.ts).
 *
 * Provenance: a real argus-lens 0.14.1.dev11+geac264e run (its `dev` HEAD,
 * recorded 2026-11-21) of `argus-lens caption -b hybrid:ram+openai-compat
 * --prompt straightforward --refine-variants identity`: RAM++ tags on CUDA
 * (under an argus-iris `caption` lease), qwen3-vl:2b-instruct prose and the
 * identity variant refined by qwen3:4b-instruct, both from Ollama on CPU. The
 * result is kept verbatim, less the `name` the JSON exporter adds; only the
 * recording fields at the end of `metadata` (from `recorded` on) are Studio's.
 * The source image is "Painted Lady" by the U.S. Fish and Wildlife Service,
 * Northeast Region, on Flickr under the Public Domain Mark 1.0, shared from
 * argus-lightbox's demo tape (photo d34f3d90d7e87939, via Megalith-10m): the
 * same 720x960 WebP, captioned as is, ships at
 * `public/demo/lens/painted-lady.webp`.
 */

import type { CaptionResult } from "@/types";

export const RECORDED_CAPTION: CaptionResult = {
  "final_caption": "butterfly, flower, pink",
  "caption_variants": {
    "identity": "butterfly, flower, pink",
    "wardrobe": "flower, butterfly, pink, a vibrant, detailed butterfly with intricately patterned wings rests on a bright pink flower",
    "pose_composition": "flower, butterfly, pink, a vibrant, detailed butterfly with intricately patterned wings rests on a bright pink flower",
    "setting": "the background is a soft, out-of-focus green, suggesting a natural outdoor setting, flower, butterfly, pink",
    "lighting": "a vibrant, detailed butterfly with intricately patterned wings rests on a bright pink flower, flower, butterfly, pink",
    "action": "flower, butterfly, pink, a vibrant, detailed butterfly with intricately patterned wings rests on a bright pink flower",
    "training": "flower, butterfly, pink, sit, purple, perch, break, nectar",
    "training_prose": "A vibrant, detailed butterfly with intricately patterned wings rests on a bright pink flower. The butterfly's wings display a complex design, featuring black and white markings, with patches of orange and a prominent blue eye-like spot near the wingtip.",
    "zeroshot": "the flower has a dense, spiky orange center and wide, velvety pink petals, flower, butterfly, sit, purple, perch, break, nectar, a vibrant, detailed butterfly with intricately patterned wings rests on a bright pink flower"
  },
  "selected_category": "identity",
  "removed_phrases": [
    "the flower has a dense, spiky orange center and wide, velvety pink petals",
    "the butterfly's wings display a complex design, featuring black and white markings, with patches of orange and a prominent blue eye-like spot near the wingtip",
    "a vibrant, detailed butterfly with intricately patterned wings rests on a bright pink flower",
    "the background is a soft, out-of-focus green, suggesting a natural outdoor setting",
    "sit",
    "purple",
    "perch",
    "break",
    "nectar",
    "flower",
    "butterfly",
    "pink",
    "the flower has a dense, spiky orange center and wide, velvety pink petals.",
    "the background is a soft, out-of-focus green, suggesting a natural outdoor setting."
  ],
  "compaction_notes": [
    "Trimmed lower-priority fragments to keep captions compact.",
    "Repaired disjointed fragments in assembled captions.",
    "Refined identity with qwen3:4b-instruct."
  ],
  "raw_tags": "flower, butterfly, pink, sit, purple, perch, break, nectar",
  "raw_prose": "A vibrant, detailed butterfly with intricately patterned wings rests on a bright pink flower. The butterfly's wings display a complex design, featuring black and white markings, with patches of orange and a prominent blue eye-like spot near the wingtip. The flower has a dense, spiky orange center and wide, velvety pink petals. The background is a soft, out-of-focus green, suggesting a natural outdoor setting.",
  "backend_name": "hybrid",
  "metadata": {
    "empty_categories": [
      "wardrobe",
      "pose_composition",
      "action"
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
          "flower",
          "butterfly",
          "pink",
          "sit",
          "purple",
          "perch",
          "break",
          "nectar"
        ]
      },
      "prose": {
        "identity": [],
        "wardrobe": [],
        "pose_composition": [],
        "setting": [
          "the background is a soft, out-of-focus green, suggesting a natural outdoor setting"
        ],
        "lighting": [
          "a vibrant, detailed butterfly with intricately patterned wings rests on a bright pink flower",
          "the butterfly's wings display a complex design, featuring black and white markings, with patches of orange and a prominent blue eye-like spot near the wingtip"
        ],
        "action": [],
        "unclassified": [
          "the flower has a dense, spiky orange center and wide, velvety pink petals"
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
    "reconciled_tags": "flower, butterfly, pink, sit, purple, perch, break, nectar",
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
    "lens_version": "0.14.1.dev11+geac264e",
    "backend": "hybrid:ram+openai-compat",
    "tag_model": "RAM++ (ram_plus_swin_large_14m)",
    "prose_model": "qwen3-vl:2b-instruct (prompt: straightforward)",
    "refine_model": "qwen3:4b-instruct (identity variant)",
    "device": "cuda",
    "image": "painted-lady.webp",
    "source": {
      "title": "Painted Lady",
      "author": "U.S. Fish and Wildlife Service - Northeast Region",
      "license": "Public Domain Mark 1.0",
      "source_url": "https://www.flickr.com/photos/usfwsnortheast/48671279001",
      "via": "argus-lightbox demo tape (Megalith-10m)"
    },
    "lens_commit": "eac264e23",
    "recorded_at": "2026-11-21"
  }
};

/** The captioned image, as shipped with the static demo. */
export const RECORDED_CAPTION_IMAGE = {
  src: "/demo/lens/painted-lady.webp",
  width: 720,
  height: 960,
  alt:
    "A painted lady butterfly, wings spread in orange, black and white, feeding on a bright pink coneflower " +
    "with a spiky orange centre, against a soft green background.",
  attribution: "U.S. Fish and Wildlife Service, Northeast Region, Painted Lady, Public Domain Mark 1.0, via Flickr",
  sourceUrl: "https://www.flickr.com/photos/usfwsnortheast/48671279001",
} as const;
