# Curator demo sample: provenance

The 14 images behind the static `/curate` demo are **real photographs** from
[PD12M](https://huggingface.co/datasets/Spawning/PD12M), every one released **CC0**, found and fetched
through argus-quarry's archive index on 2026-11-21. They replace the synthetic SDXL sets of 2026-11-14 to
2026-11-20. The scan (`scan.json`) and the thumbnails (`thumbs/`) are a **real recording of argus-curator
0.18.0** (its `dev` HEAD, commit `b94d89b`, the build `frontend/schema/pins.json` pins for the wire types)
run over those images: no number in it was edited by hand. `recording.json` records that version, the date
and the scan options; `frontend/schema/demo.json` records the commit, and `src/lib/demoRecordings.test.ts`
fails if the three disagree.

Only the curator's own 384 px WebP thumbnails are bundled. The images themselves are not, to keep the site
small; `scripts/make_curator_sample.py` rebuilds them from quarry.

## How the set was chosen

PD12M ships CLIP embeddings, and quarry's index ranks by them (`similar_to`). Searches for colourful sports
photos, then "more like this" from the good hits, gave a pool of 124 frames from the Estonian Sports and
Olympic Museum and from Wikimedia Commons (a championship athletics meet, handball and volleyball). The pool
was scanned once with faces, MiVOLO and NudeNet only, and the set keeps frames where:

- the same person appears in more than one frame (the curator put them in one face cluster), so the demo
  shows identity clusters from real photos;
- every face reads as an adult. Crowds behind the play held faces MiVOLO read as children (25 of the 124
  frames had a read under 18), and those frames are out, background faces included. The NudeNet `suggestive`
  rating was not used to drop frames: in this pool it marks ordinary sports kit (covered-chest detections,
  exposed score 0.0), the kind of footage broadcast on public television.

`scripts/make_curator_sample.py` is the whole recipe. It asks quarry for each PD12M item, downloads the image
from the URL quarry records, checks its sha256, scales it to at most 2048 px on the long side and saves it as
a fresh JPEG (quality 92, no EXIF or XMP). Larger originals in the pool grew a scanning curator's ONNX arena
to most of the GPU, which is why the set is capped. Four files are derived:

- **Near duplicate.** `skier/02_copy.jpg` is `skier/02.jpg` with 2% trimmed from each edge, re-encoded.
- **Rejects.** A heavy Gaussian blur (radius 8) of a marathon runner, a 160 px-wide copy of a high-jump frame,
  and a 5:1 band cut from a 2.25× upscale of a relay heat (so the short side clears 512 px and only the aspect
  ratio fails).

| Sample file | PD12M id | Institution | What it shows |
|---|---|---|---|
| `handball_a/01.jpg` | `dcdc8d02721d6a9d66949d917c1f1f71` | Wikimedia Commons | a handball player, #10 in blue, ball in hand |
| `handball_a/02.jpg` | `84c403799ac4194c50a7e2de43631344` | Wikimedia Commons | the same player winding up a throw |
| `handball_a/03.jpg` | `a673dd30d9051f45c59c4e846f0c287b` | Wikimedia Commons | a player in yellow, #7, driving forward (the curator puts her in the same face cluster) |
| `handball_b/01.jpg` | `2bed74fb5e122ae117fa27e5a3e687f6` | Wikimedia Commons | a handball player in coral, mid-throw |
| `handball_b/02.jpg` | `ec3e8c751205cff6789e9bfb146f4f81` | Wikimedia Commons | the same player, #8, on court |
| `volleyball/01.jpg` | `35cfe2e5d8dae19ec21b019c2a532913` | Wikimedia Commons | a volleyball player in blue and white, leaping to serve |
| `volleyball/02.jpg` | `9f12f7f0e4a630e047f1e3ddd26f8718` | Wikimedia Commons | the same player a moment later, arm back |
| `skier/01.jpg` | `1281368a97e4484c1014afc344189c25` | Estonian Sports and Olympic Museum | a cross-country skier in red gloves and goggles |
| `skier/02.jpg` | `e3b09846f651f96b5daee7ad42de8064` | Estonian Sports and Olympic Museum | the same skier racing at the Nagano Olympics, bib 33 |
| `skier/02_copy.jpg` | as `skier/02.jpg` |  | near duplicate (2% crop, re-encoded) |
| `relay/group_shot.jpg` | `43dae84e9f1380cf01e57aa878662a28` | Wikimedia Commons | a relay team together after their race |
| `rejects/blurry.jpg` | `2e9ff3432b53c5628d2849e0a87c954f` | Wikimedia Commons | a marathon runner (blurred) |
| `rejects/lowres.jpg` | `121d9531114127b8bf7c45dbdeeaccad` | Wikimedia Commons | a high jumper over the bar (160 px wide) |
| `rejects/wide_banner.jpg` | `09dc65f4cb65d342991f2ed171b711e7` | Wikimedia Commons | a relay heat (5:1 band) |

The people in these photos are real athletes photographed in public competition, released by their
photographers or institutions under CC0. The demo shows what the curator reads from the frames (clusters,
MiVOLO age bands, ratings); it names no one.

## The recorded scan

`scripts/record_curator_demo.py` sent `POST /scan/folder` to a throwaway `ghcr.io/smk762/argus-curator:0.18.0-gpu`
(`dev` at `b94d89b` is that release) with the set mounted at `/data/images`, its face, scene and garment models
leased from argus-iris, on 2026-11-21, then saved the
`ScanSummary` verbatim and fetched each image's `GET /thumb`. Options: photo / SDXL / identity target;
min short side 512, max aspect 3.0, blur threshold 100, pHash cluster distance 10; InsightFace `buffalo_l`
faces with MiVOLO age and gender; Places365 scenes; Fashionpedia garments; NudeNet (the imogen NudeNet
server); SingGuard (`SingGuard-4b`, the Q4_K_M GGUF through Ollama on dragon) under the `adult` policy with the
`adult-granular` variant. The detectors matter: retina's NudeNet 640m reports covered-chest detections
differently from this server, so swapping detectors can change the ratings and the recording.

What it found is what the page shows:

- **Rejects.** The blurred frame fails on sharpness (6 < 100), the 160 px frame on resolution and the banner on
  aspect ratio.
- **Faces.** The first handball player's three frames fall in one face cluster (the third, in a different kit,
  may be a clustering error; it is the curator's real output), the second player's two in another, and the
  volleyball player's and the skier's in one each. `skier/02_copy.jpg` is flagged as a near duplicate of `skier/02.jpg`.
  The relay team photo holds four faces, and the crowd behind `handball_a/03.jpg` six more, each in a cluster
  of its own.
- **Ages.** MiVOLO reads every face as an adult, from about 20 to 52 (the youngest read is 19.6, a volleyball frame); the same person can read years apart
  between frames.
- **Moderation.** NudeNet rated three passing frames `suggestive` on covered-chest detections (the handball
  kit) and the rest safe; the exposed score is 0.0 throughout, so no passing frame is blurred (that
  takes 0.25); rejected frames are always veiled. SingGuard judged every passing frame safe under both `adult` and
  `adult-granular`, each on its fast pass (the cascade thinks only when the fast pass flags something). It ran
  with one worker and a 300 s timeout, and any scan whose log held a failed remote check was discarded and
  run again; this one had none.

## Licences

- **The photographs:** CC0, as PD12M records each one (Spawning's PD12M keeps only CC0 and Public Domain Mark
  images). No attribution is required; the institution is named above as a courtesy.
- **Derived frames** (the near duplicate and the three rejects) are released under CC0 too.
- The scan and thumbnails ship with Argus Studio as demo data.
