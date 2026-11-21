# Curator demo sample: provenance

The 14 images behind the static `/curate` demo are **synthetic**. The current set was generated on 2026-11-20:
colourful action scenes (bouldering, a Holi colour festival, paddleboarding, road cycling, a street-market wok, a
beach kite) replacing the quieter portraits of 2026-11-14 and 2026-11-18. The two people in them are **fictional**: they were described in words, not taken from photos,
and they do not depict or imitate any real person. The scan (`scan.json`) and the thumbnails (`thumbs/`) are
a **real recording of argus-curator 0.18.0** (its `dev` HEAD, commit `b94d89b`, the build
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
   from the frame's own text render, so each person keeps one face. The two references keep their 2026-11 prompts
   and prompt tail, so both people have the same faces as in the earlier sets.
3. **Group shot.** A text render of both people (seed 3305, the first from 3300 up whose render shows exactly one
   woman and one man and no other face: a bystander's face would be scanned and aged too); each face was
   re-rendered with InstantID in a tight crop around it (seeds 61000 for person A, 61001 for person B) and feathered
   back over the face only. Its negative prompt adds "crowd, bystanders, third person, people in the background,
   mural, poster": a fun-run finish line and a mural wall both brought in extra faces, some of which MiVOLO read as
   teenagers, so the frame now stands two people against a plain wall.
4. **Near duplicate.** `02_copy.jpg` repeats `02.jpg`'s identity pass, same seeds, at CFG 5.3.
5. **Rejects.** A heavy Gaussian blur (radius 8) of a text-only render, a 160 px-wide downscale, and a 5:1 crop
   of a 2.25× Lanczos upscale (so the short side clears 512 px and only the aspect ratio fails).
6. **Clean-up.** Saved as JPEG (quality 90) from fresh pixel buffers: no EXIF, XMP or workflow metadata. The
   curator re-encodes its thumbnails, which carry none either.

The first set from this script (2026-11-14) replaced an earlier one made the same morning with the same
descriptions and seeds, whose text renders ran in ComfyUI and whose generation scripts were not kept. The
2026-11-18 run regenerated that set for a curator pin move. On 2026-11-20 the scenes were replaced to make the demo
more colourful; the seeds, checkpoint, sampler and identity references stayed. Each frame's clothing comes first in
its scene prompt where it matters, because CLIP reads only 77 tokens and the character description uses most of
them. The originals of this run are kept outside the repository, so a later pin move can rescan the same files.

Character descriptions (the start of every prompt):

- **Person A:** "a fictional 36 year old woman, mature adult face, fine laugh lines at the corners of her
  eyes, oval face, light freckles, green-grey eyes, shoulder-length wavy auburn hair, small silver stud
  earrings"
- **Person B:** "a fictional 45 year old man, square jaw, short salt-and-pepper hair, neatly trimmed greying
  beard, warm brown eyes, faint smile lines"

Every prompt ends with "vivid colours, candid action photograph, natural skin texture, realistic, sharp focus, fast
shutter" (the references: "professional photograph, natural skin texture, realistic, 85mm lens, sharp focus, soft
light"). CLIP truncates long prompts at 77 tokens, so most of this tail is dropped. Negative prompt:
"nude, nsfw, topless, cleavage, lingerie, underwear, sexy, celebrity, famous person, cartoon, anime,
painting, illustration, 3d render, cgi, deformed, disfigured, extra fingers, bad hands, watermark, text,
logo, signature, frame, low quality, worst quality, motion blur, blurry, dull colours", plus "teenager, young girl, childlike" for person A.

| Sample file | Text-render seed | InstantID seed | Scene prompt (after the character description) |
|---|---|---|---|
| `personA/climb/01.jpg` | 1101 | 51101 | wearing a loose teal t-shirt, bouldering in a bright indoor climbing gym, mid-climb on a wall of colourful holds, chalked hands, looking back over her shoulder at the camera, smiling, upper body |
| `personA/climb/02.jpg` | 1110 | 51110 | wearing a loose teal t-shirt, bouldering in a bright indoor climbing gym, three-quarter view, reaching for a yellow hold on a wall of colourful holds, upper body |
| `personA/climb/02_copy.jpg` | 1110 | 51110 (CFG 5.3) | as `02.jpg` |
| `personA/holi/03.jpg` | 1120 | 51120 | laughing at a holi colour festival, clouds of pink, yellow and blue powder in the air, powder on her face and white shirt, looking at the camera, upper body portrait, daylight |
| `personA/holi/04.jpg` | 1131 | 51131 | side profile view looking to the left, throwing a handful of bright pink powder at a holi colour festival, upper body, white shirt covered in coloured powder, daylight |
| `personA/water/05.jpg` | 1150 | 51150 | stand-up paddleboarding on turquoise water, wearing a bright orange life vest over a teal long-sleeve rash guard, waist-up, laughing, looking at the camera, sunny summer day |
| `personB/cycle/01.jpg` | 2201 | 52201 | road cyclist in a bright red and yellow cycling jersey and helmet, no sunglasses, looking directly at the camera, head and shoulders portrait, on a sunny alpine pass |
| `personB/cycle/02.jpg` | 2210 | 52210 | road cyclist in a bright red and yellow cycling jersey and helmet, no sunglasses, three-quarter view, riding hard uphill out of the saddle, upper body, sunny alpine pass |
| `personB/market/03.jpg` | 2220 | 52220 | street food cook in a white t-shirt and a black apron, tossing vegetables in a flaming wok, looking at the camera, grinning, upper body, busy night market, red lanterns and neon signs behind him |
| `personB/market/04.jpg` | 2230 | 52230 | street food cook in a white t-shirt and a black apron, side profile view looking to the right, flames leaping from his wok, upper body, busy night market, red lanterns and neon signs |
| `mixed/group_shot.jpg` | 3305 | 61000 / 61001 (per face) | (own prompt) medium shot of two friends standing a step apart after a run, plain bright yellow wall behind them, a woman with wavy auburn hair in a pink running top, a 45 year old man with a greying beard in a blue running vest, both laughing |
| `personB/rejects/blurry.jpg` | 2211 | none (text render, then blur) | as `cycle/02.jpg` |
| `personA/rejects/lowres.jpg` | 1121 | 51121 (then 160 px wide) | as `holi/03.jpg` |
| `misc/wide_banner.jpg` | 4400 | 54400 (then 2.25× and a 5:1 crop) | small in frame, flying a bright rainbow kite while running along a wide beach at sunset, wide landscape shot |

## The recorded scan

`scripts/record_curator_demo.py` sent `POST /scan/folder` to a throwaway `ghcr.io/smk762/argus-curator:0.18.0-gpu`
(`dev` at `b94d89b` is that release) with the set mounted at `/data/images`, its face, scene and garment models
leased from argus-iris, on 2026-11-21, then saved the
`ScanSummary` verbatim and fetched each image's `GET /thumb`. Options: photo / SDXL / identity target;
min short side 512, max aspect 3.0, blur threshold 100, pHash cluster distance 10; InsightFace `buffalo_l`
faces with MiVOLO age and gender; Places365 scenes; Fashionpedia garments; NudeNet (the imogen NudeNet
server); SingGuard (`SingGuard-4b`, the Q4_K_M GGUF through Ollama on dragon) under the `adult` policy with the
`adult-granular` variant. The detectors matter: retina's NudeNet 640m does not report the covered-chest
detection behind three frames' `suggestive` rating, so swapping detectors changes the recording.

What it found is what the page shows:

- **Rejects.** The blurred frame fails on sharpness (6 < 100): curator 0.15.1 measures the frame's interior
  ([argus-curator#147](https://github.com/smk762/argus-curator/issues/147)), so a blurred bright frame no
  longer passes on its edges as it did in the 0.15.0 recording. The 160 px frame fails on resolution and the
  banner on aspect ratio.
- **Faces.** Every person A frame, profile included, falls in one face cluster and every person B frame in
  another, and the group shot holds one face from each. `climb/02.jpg` is flagged as a near duplicate of
  `climb/02_copy.jpg`. The busier scenes also catch four bystanders (one at the Holi festival, three at the
  night market), each in a cluster of its own.
- **Ages.** MiVOLO reads both people younger than their descriptions: person A at about 24–27, person B at
  about 29–34. The bystanders read at about 27 to 44. Every face is an adult's.
- **Moderation.** NudeNet rated three passing frames `suggestive` on a covered-chest detection (exposed score
  0.0 throughout): the group shot, the paddleboard frame and, a false positive on a man in a cycling jersey,
  `cycle/02.jpg`. They show under Suggestive in the content-rating facet. A passing frame is blurred only once
  its exposed reading reaches 0.25, so none of these is; rejected frames are always veiled. SingGuard judged
  every frame safe under both `adult` and `adult-granular`. It ran in `cascade`, the curator's default
  (`guard_config.thinking`): `fast` passed every frame, so none was escalated to `slow` and every verdict records
  `fast`. The shared SingGuard endpoint was busy that night, so the curator ran with one SingGuard worker and a
  300 s timeout (`ARGUS_CURATOR_SINGGUARD_WORKERS`, `ARGUS_CURATOR_SINGGUARD_TIMEOUT`), and scans that lost a
  verdict to a 503 or a timeout were discarded and run again, not patched.

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
