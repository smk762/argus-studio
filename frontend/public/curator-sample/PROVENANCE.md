# Curator demo sample: provenance

The 14 images behind the static `/curate` demo are **synthetic**. They were generated for this demo on
2026-11-14. The two people in them are **fictional**: they were described in words, not taken from photos,
and they do not depict or imitate any real person. The scan (`scan.json`) and the thumbnails (`thumbs/`) are
a **real recording of argus-curator 0.15.0** run over those images: no number in it was edited by hand.

Only the curator's own 384 px WebP thumbnails are bundled. The full-size originals (832×1216 portraits,
1216×832 group shot) are not, to keep the site small; they can be regenerated from the seeds below.

## How the images were made

1. **Text render.** SDXL text-to-image in ComfyUI, checkpoint **CyberRealistic XL Desire v2.0**
   (`cyberrealisticXL_desireV20.safetensors`, by Cyberdelia). DPM++ 2M SDE Karras, 30 steps, CFG 5.0.
   Each person has one fixed character description; each picture adds a scene, outfit and pose.
2. **Identity pass.** Text alone does not keep a face consistent enough for face clustering, so each
   picture was re-rendered with **InstantID** (InstantX; IP-Adapter + IdentityNet ControlNet, diffusers,
   same checkpoint and sampler): the face embedding comes from one synthetic reference per person
   (person A: `A2_ref_1`, a text render with seed 7701 of the person A description below in a denim jacket
   in a park; person B: the `B_tv_front_1` text render) and the head pose comes from that picture's own text
   render. Person A's first text renders read as early twenties to MiVOLO, so her description was made
   older and she was re-rendered from a new reference; the pose renders were kept. ControlNet and IP-Adapter scale 0.8. In the group shot, each face of the text
   render was re-rendered this way and blended back with a feathered mask.
3. **Near duplicate.** `02_copy.jpg` is `02.jpg`'s render repeated with the same seed at CFG 5.3.
4. **Rejects.** Made from generated frames: a heavy Gaussian blur, a 160 px-wide downscale, and a 5:1 crop
   (of a 2.25× Lanczos upscale, so the short side clears 512 px and only the aspect ratio fails).
5. **Clean-up.** Saved as JPEG (quality 90) from fresh pixel buffers: no EXIF, XMP or ComfyUI workflow
   metadata. The curator re-encodes its thumbnails, which carry none either.

Character descriptions (the start of every prompt):

- **Person A:** "a fictional 36 year old woman, mature adult face, fine laugh lines at the corners of her
  eyes, oval face, light freckles, green-grey eyes, shoulder-length wavy auburn hair, small silver stud
  earrings" (the pose renders used an earlier, younger-reading description: "a fictional 32 year old
  woman, oval face, light freckles across her nose, green-grey eyes, shoulder-length wavy auburn hair with
  a side parting, small silver stud earrings, natural makeup")
- **Person B:** "a fictional 45 year old man, square jaw, short salt-and-pepper hair, neatly trimmed greying
  beard, warm brown eyes, faint smile lines"

Every prompt ends with "professional photograph, natural skin texture, realistic, 85mm lens, sharp focus,
soft light" (CLIP truncates long prompts at 77 tokens, so some of this tail was dropped). Negative prompt:
"nude, nsfw, topless, cleavage, lingerie, underwear, sexy, celebrity, famous person, cartoon, anime,
painting, illustration, 3d render, cgi, deformed, disfigured, extra fingers, bad hands, watermark, text,
logo, signature, frame, low quality, worst quality" (person A's identity pass added "teenager, young girl,
childlike").

| Sample file | Made from | Text-render seed | InstantID seed | Scene prompt (after the character description) |
|---|---|---|---|---|
| `personA/studio/01.jpg` | `A_studio_front_1` | 1101 | 51101 | wearing an elegant burgundy dress, looking directly at the camera, head and shoulders portrait, in a theatre dressing room with a lit mirror behind her |
| `personA/studio/02.jpg` | `A_studio_34_0` | 1110 | 51110 | wearing an elegant burgundy dress, three-quarter view, face turned slightly to the side, upper body portrait, in a theatre dressing room with a lit mirror |
| `personA/studio/02_copy.jpg` | `A_studio_34_0dup` | 1110 | 51110 | wearing an elegant burgundy dress, three-quarter view, face turned slightly to the side, upper body portrait, in a theatre dressing room with a lit mirror |
| `personA/outdoor/03.jpg` | `A_park_front_0` | 1120 | 51120 | wearing a denim jacket over a white t-shirt, looking at the camera, smiling, upper body portrait, outdoors in a green city park, trees behind her, daylight |
| `personA/outdoor/04.jpg` | `A_park_profile_1` | 1131 | 51131 | wearing a denim jacket over a white t-shirt, side profile view looking to the left, upper body, outdoors in a green city park, autumn trees, daylight |
| `personA/outdoor/05.jpg` | `A_beach_0` | 1150 | 51150 | wearing a modest navy one-piece swimsuit, standing on a sandy beach, waist-up portrait, ocean and sky behind her, summer daylight, wholesome holiday photo |
| `personB/set1/01.jpg` | `B_tv_front_1` | 2201 | 52201 | wearing a navy blazer over a light blue shirt, looking directly at the camera, head and shoulders portrait, in a television studio with studio lights and screens behind him |
| `personB/set1/02.jpg` | `B_tv_34_0` | 2210 | 52210 | wearing a navy blazer over a light blue shirt, three-quarter view, upper body portrait, seated in a television studio set |
| `personB/set2/03.jpg` | `B_street_front_0` | 2220 | 52220 | wearing a brown leather jacket, looking at the camera, upper body portrait, outdoors on a city street, daylight |
| `personB/set2/04.jpg` | `B_street_profile_0` | 2230 | 52230 | wearing a brown leather jacket, side profile view looking to the right, upper body, outdoors on a city street, daylight |
| `mixed/group_shot.jpg` | `G_group_0` text render, then each face re-rendered with InstantID (seeds 61000, 61001) and blended back | 3300 | 61000/61001 | two colleagues side by side in a park; she wears a green cardigan, he a navy blazer |
| `personB/rejects/blurry.jpg` | `B_tv_34_1` (text-only render) + Gaussian blur radius 8 | 2211 | none (text render only) | wearing a navy blazer over a light blue shirt, three-quarter view, upper body portrait, seated in a television studio set |
| `personA/rejects/lowres.jpg` | `A_park_front_1` downscaled to 160 px wide | 1121 | 51121 | wearing a denim jacket over a white t-shirt, looking at the camera, smiling, upper body portrait, outdoors in a green city park, trees behind her, daylight |
| `misc/wide_banner.jpg` | `R_banner_src` upscaled 2.25x (Lanczos), then a 5:1 crop | 4400 | 54400 | small in frame, walking along a wide beach promenade at sunset, wide landscape shot |

## The recorded scan

`scripts/record_curator_demo.py` sent `POST /scan/folder` to a throwaway
`ghcr.io/smk762/argus-curator:0.15.0-gpu` container with the set mounted at `/data/images`, then saved the
`ScanSummary` verbatim and fetched each image's `GET /thumb`. Options: photo / SDXL / identity target;
min short side 512, max aspect 3.0, blur threshold 100, pHash cluster distance 10; InsightFace `buffalo_l`
faces with MiVOLO age and gender; Places365 scenes; Fashionpedia garments; NudeNet; SingGuard
(`SingGuard-4b`) under the `adult` policy with the `adult-granular` variant.

What it found is what the page shows, including where it differs from the old hand-written sample:
MiVOLO reads person A at about 32–40 and person B at about 43–51. Face clustering puts person B's three
frontal frames and his face in the group shot together, but splits person A across several clusters and
gives each profile its own. NudeNet rated every frame safe (the swimsuit frame only reports exposed
armpits) and SingGuard judged every frame safe, so no passing frame is blurred for review; rejected frames
are always veiled. The blurred reject is a darker frame: curator 0.15.0's sharpness measure also counts the
frame's outer edge, so a heavily blurred bright frame still scores above the threshold.

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
