# Curator demo sample: provenance

The 14 images behind the static `/curate` demo are **synthetic**. They were generated for this demo on
2026-11-14. The two people in them are **fictional**: they were described in words, not taken from photos,
and they do not depict or imitate any real person. The scan (`scan.json`) and the thumbnails (`thumbs/`) are
a **real recording of argus-curator 0.15.2.dev2+g97021d6** (its `dev` HEAD, commit `97021d6`, the build
`frontend/schema/pins.json` pins for the wire types) run over those images: no number in it was edited by
hand. `recording.json` records that version, the date and the scan options; `frontend/schema/demo.json`
records the commit, and `src/lib/demoRecordings.test.ts` fails if the three disagree.

Only the curator's own 384 px WebP thumbnails are bundled. The full-size originals (832×1216 portraits,
1216×832 group shot) are not, to keep the site small; `scripts/make_curator_sample.py` regenerates them.

## How the images were made

`scripts/make_curator_sample.py` is the whole recipe, in diffusers, and `generation.json` is what it wrote:
every prompt, seed and whether the identity pass applied.

1. **Text render.** SDXL, checkpoint **CyberRealistic XL Desire v2.0** (`cyberrealisticXL_desireV20.safetensors`,
   by Cyberdelia). DPM++ 2M SDE Karras, 30 steps, CFG 5.0.
2. **Identity pass.** **InstantID** (InstantX; IdentityNet ControlNet + IP-Adapter, scale 0.8, same checkpoint
   and sampler). The face embedding comes from one synthetic reference per person (person A: a text render,
   seed 7701, in a denim jacket in a park; person B: his `set1/01` text render, seed 2201) and the head pose
   from the frame's own text render, so each person keeps one face.
3. **Group shot.** A text render of both people (seed 3300); each face was re-rendered with InstantID in a
   tight crop around it (seeds 61000 for person A, 61001 for person B) and feathered back over the face only.
4. **Near duplicate.** `02_copy.jpg` repeats `02.jpg`'s identity pass, same seeds, at CFG 5.3.
5. **Rejects.** A heavy Gaussian blur (radius 8) of a text-only render, a 160 px-wide downscale, and a 5:1 crop
   of a 2.25× Lanczos upscale (so the short side clears 512 px and only the aspect ratio fails).
6. **Clean-up.** Saved as JPEG (quality 90) from fresh pixel buffers: no EXIF, XMP or workflow metadata. The
   curator re-encodes its thumbnails, which carry none either.

The set replaces an earlier one made the same morning with the same descriptions and seeds, whose text
renders ran in ComfyUI and whose generation scripts were not kept. The images differ; the recipe is now in
the repo.

Character descriptions (the start of every prompt):

- **Person A:** "a fictional 36 year old woman, mature adult face, fine laugh lines at the corners of her
  eyes, oval face, light freckles, green-grey eyes, shoulder-length wavy auburn hair, small silver stud
  earrings"
- **Person B:** "a fictional 45 year old man, square jaw, short salt-and-pepper hair, neatly trimmed greying
  beard, warm brown eyes, faint smile lines"

Every prompt ends with "professional photograph, natural skin texture, realistic, 85mm lens, sharp focus,
soft light" (CLIP truncates long prompts at 77 tokens, so some of this tail is dropped). Negative prompt:
"nude, nsfw, topless, cleavage, lingerie, underwear, sexy, celebrity, famous person, cartoon, anime,
painting, illustration, 3d render, cgi, deformed, disfigured, extra fingers, bad hands, watermark, text,
logo, signature, frame, low quality, worst quality", plus "teenager, young girl, childlike" for person A.

| Sample file | Text-render seed | InstantID seed | Scene prompt (after the character description) |
|---|---|---|---|
| `personA/studio/01.jpg` | 1101 | 51101 | wearing an elegant burgundy dress, looking directly at the camera, head and shoulders portrait, in a theatre dressing room with a lit mirror behind her |
| `personA/studio/02.jpg` | 1110 | 51110 | wearing an elegant burgundy dress, three-quarter view, face turned slightly to the side, upper body portrait, in a theatre dressing room with a lit mirror |
| `personA/studio/02_copy.jpg` | 1110 | 51110 (CFG 5.3) | as `02.jpg` |
| `personA/outdoor/03.jpg` | 1120 | 51120 | wearing a denim jacket over a white t-shirt, looking at the camera, smiling, upper body portrait, outdoors in a green city park, trees behind her, daylight |
| `personA/outdoor/04.jpg` | 1131 | 51131 | wearing a denim jacket over a white t-shirt, side profile view looking to the left, upper body, outdoors in a green city park, autumn trees, daylight |
| `personA/outdoor/05.jpg` | 1150 | 51150 | wearing a modest navy one-piece swimsuit, standing on a sandy beach, waist-up portrait, ocean and sky behind her, summer daylight, wholesome holiday photo |
| `personB/set1/01.jpg` | 2201 | 52201 | wearing a navy blazer over a light blue shirt, looking directly at the camera, head and shoulders portrait, in a television studio with studio lights and screens behind him |
| `personB/set1/02.jpg` | 2210 | 52210 | wearing a navy blazer over a light blue shirt, three-quarter view, upper body portrait, seated in a television studio set |
| `personB/set2/03.jpg` | 2220 | 52220 | wearing a brown leather jacket, looking at the camera, upper body portrait, outdoors on a city street, daylight |
| `personB/set2/04.jpg` | 2230 | 52230 | wearing a brown leather jacket, side profile view looking to the right, upper body, outdoors on a city street, daylight |
| `mixed/group_shot.jpg` | 3300 | 61000 / 61001 (per face) | (own prompt) medium shot of two colleagues standing a step apart in a green city park, a woman with wavy auburn hair in a green cardigan, a 45 year old man with a greying beard in a navy blazer, both smiling, daylight |
| `personB/rejects/blurry.jpg` | 2211 | none (text render, then blur) | as `set1/02.jpg` |
| `personA/rejects/lowres.jpg` | 1121 | 51121 (then 160 px wide) | as `outdoor/03.jpg` |
| `misc/wide_banner.jpg` | 4400 | 54400 (then 2.25× and a 5:1 crop) | small in frame, walking along a wide beach promenade at sunset, wide landscape shot |

## The recorded scan

`scripts/record_curator_demo.py` sent `POST /scan/folder` to a throwaway argus-curator built from `dev` at
`97021d6` (the `-gpu` image, run on CPU) with the set mounted at `/data/images`, then saved the
`ScanSummary` verbatim and fetched each image's `GET /thumb`. Options: photo / SDXL / identity target;
min short side 512, max aspect 3.0, blur threshold 100, pHash cluster distance 10; InsightFace `buffalo_l`
faces with MiVOLO age and gender; Places365 scenes; Fashionpedia garments; NudeNet; SingGuard
(`SingGuard-4b`) under the `adult` policy with the `adult-granular` variant.

What it found is what the page shows:

- **Rejects.** The blurred frame fails on sharpness (5 < 100): curator 0.15.1 measures the frame's interior
  ([argus-curator#147](https://github.com/smk762/argus-curator/issues/147)), so a blurred bright frame no
  longer passes on its edges as it did in the 0.15.0 recording. The 160 px frame fails on resolution and the
  banner on aspect ratio.
- **Faces.** Every person A frame, profile included, falls in one face cluster and every person B frame in
  another, with person B's face in the group shot. `02.jpg` is flagged as a near duplicate of `02_copy.jpg`.
- **Ages.** MiVOLO reads both people younger than their descriptions: person A at about 23–25, person B at
  about 31–36 (the group shot's faces at about 24 and 32). Both are adults throughout.
- **Moderation.** NudeNet rated every frame safe (the swimsuit frame only reports exposed armpits, exposed
  score 0.0) and SingGuard judged every frame safe, so no passing frame is blurred for review; rejected
  frames are always veiled.

## Licences

- **CyberRealistic XL Desire v2.0:** CreativeML Open RAIL-M (as declared on the author's Hugging Face
  model card). The licence lets you use generated outputs, including in public demos, subject to its use
  restrictions (no impersonation of real people, no harmful content, and so on). This sample keeps to them:
  fictional people, safe-for-work scenes.
- **InstantID** (pipeline code, IdentityNet ControlNet and IP-Adapter weights, InstantX): Apache-2.0.
  Its face encoder is InsightFace's `antelopev2`, whose pretrained weights InsightFace releases for
  non-commercial research use; it was used only to make this non-commercial demo sample. argus-curator's
  own face detection uses InsightFace `buffalo_l` under the same terms.
- The images and the recorded scan ship with Argus Studio as demo data; reuse them on the terms above.
