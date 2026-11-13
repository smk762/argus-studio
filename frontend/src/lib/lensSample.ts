/**
 * Recorded argus-lens caption for the static demo (lib/staticDemo.ts).
 *
 * Provenance: a real `/caption/url` run of an earlier argus-lens on the hybrid
 * backend (WD14 tags + BLIP-style prose), transcribed verbatim from the README
 * screenshots `docs/images/spa-output-variants.png` and `spa-output-raw.png`.
 * That build still emitted the pre-split `pose` variant, kept here under its
 * legacy key `pose_composition` so the UI labels it as the alias it is. The
 * source photograph is a third-party image and is not redistributed.
 */

import type { CaptionResult } from "@/types";

const RAW_PROSE =
  "The image shows two young girls sitting around a campfire in a grassy area with two blue tents in the background. " +
  "The girl on the left is wearing a blue sweatshirt and is kneeling on the ground, while the girl in the red shirt is " +
  "kneeling next to her. They are both holding wooden sticks and appear to be preparing a fire. There are several rocks " +
  "and sticks scattered around the fire, and the girls are looking at it intently. The trees in the distance are tall " +
  "and green, suggesting that they are in a wooded area. The overall mood of the image is peaceful and serene.";

export const RECORDED_CAPTION: CaptionResult = {
  final_caption: "short_hair, brown_hair, long_sleeves, day, blurry, tree, grass, denim",
  caption_variants: {
    identity: "short_hair, brown_hair, long_sleeves, day, blurry, tree, grass, denim",
    wardrobe:
      "short_hair, brown_hair, long_sleeves, sitting, two young girls sitting around a campfire in a grassy area with two blue tents in the background, shirt, jacket",
    pose_composition:
      "short_hair, brown_hair, long_sleeves, sitting, two young girls sitting around a campfire in a grassy area with two blue tents in the background, shirt, outdoors",
    setting:
      "short_hair, brown_hair, long_sleeves, sitting, two young girls sitting around a campfire in a grassy area with two blue tents in the background",
    lighting:
      "short_hair, brown_hair, long_sleeves, sitting, they are both holding wooden sticks and appear to be preparing a fire, shirt",
    action:
      "short_hair, brown_hair, long_sleeves, sitting, two young girls sitting around a campfire in a grassy area with two blue tents in the background",
    training: "sitting, jacket, blurry_background, background, shows, girls, around, campfire",
    zeroshot:
      "several rocks and sticks scattered around the fire, and the girls are looking at it intently, the overall mood of the image is peaceful and serene, short_hair, brown_hair, long_sleeves, day, blurry, tree, grass, denim",
  },
  selected_category: "identity",
  removed_phrases: [
    "general",
    "sensitive",
    "1girl",
    "1boy",
    "the image shows",
    "there are",
    "sneakers",
    "rock",
    "several rocks and sticks scattered around the fire, and the girls are looking at it intently",
    "the overall mood of the image is peaceful and serene",
    "sitting",
    "two young girls sitting around a campfire in a grassy area with two blue tents in the background",
    "they are both holding wooden sticks and appear to be preparing a fire",
    "jacket",
    "shoes",
    "pants",
    "red_shirt",
    "jeans",
    "blue_pants",
    "the girl on the left is wearing a blue sweatshirt and is kneeling on the ground, while the girl in the red shirt is kneeling next to her",
    "the trees in the distance are tall and green, suggesting that they are in a wooded area",
    "shirt",
    "blurry_background",
    "outdoors",
    "day",
    "blurry",
    "tree",
    "grass",
    "denim",
    "long_sleeves",
  ],
  compaction_notes: [
    "Stripped rating/meta tags that have no training value.",
    "Trimmed lower-priority fragments to keep captions compact.",
    "Suppressed identity traits for training variant (learned visually).",
  ],
  raw_tags:
    "general, sensitive, 1girl, short_hair, brown_hair, shirt, long_sleeves, 1boy, sitting, jacket, outdoors, shoes, day, pants, blurry, tree, blurry_background, grass, denim, red_shirt, sneakers, jeans, rock, blue_pants",
  raw_prose: RAW_PROSE,
  backend_name: "hybrid",
  metadata: { recorded: true, source: "docs/images/spa-output-*.png" },
};

/** One-line description of the recorded source image (it is not redistributed). */
export const RECORDED_CAPTION_SUBJECT =
  "Two children building a campfire on grass, two blue tents and trees behind (third-party photo, not redistributed).";
