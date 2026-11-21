# Curator demo sample: provenance

The 50 images behind the static `/curate` demo come from two places:

- **14 real photographs** from [PD12M](https://huggingface.co/datasets/Spawning/PD12M), every one released
  **CC0**, found and fetched through argus-quarry's archive index on 2026-11-21 (sports: handball, volleyball,
  cross-country skiing, athletics);
- **36 synthetic frames** from argus-cull's demo set: five fictional adults rendered with SDXL and InstantID
  for Cull's own demo, shared with Studio so both pages show the same guard cases. Their recipe, prompts and
  checks are in argus-cull's
  [`web/public/data-tape/PROVENANCE.md`](https://github.com/smk762/argus-cull/blob/dev/web/public/data-tape/PROVENANCE.md).

They replace the synthetic SDXL sets of 2026-11-14 to 2026-11-20. The scan (`scan.json`) and the thumbnails
(`thumbs/`) are a **real recording of argus-curator 0.18.0** (its `dev` HEAD, commit `b94d89b`, the build
`frontend/schema/pins.json` pins for the wire types) run over those images: no number in it was edited by hand.
`recording.json` records that version, the date and the scan options; `frontend/schema/demo.json` records the
commit, and `src/lib/demoRecordings.test.ts` fails if the three disagree.

Only the curator's own 384 px WebP thumbnails are bundled. The images themselves are not, to keep the site
small; `scripts/make_curator_sample.py` rebuilds them from quarry and an argus-cull checkout.

## How the photos were chosen

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

`scripts/make_curator_sample.py` is the whole recipe for both sources. For the photos it asks quarry for each PD12M item, downloads the image
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

## The synthetic frames

The script copies 36 of argus-cull's 53 frames from an argus-cull checkout's demo tape
(`web/public/data-tape/images/<id>.webp`, the full 832×1216 renders, `dev` at `42a08f1`), checks each WebP's
sha256 and saves it as a fresh JPEG under `synthetic/`, keeping Cull's folder and file names. They were picked
for the cases the sports photos cannot show:

- **all eleven crime-film stills** (prop handguns pointed away from the camera, a drug deal, a smuggler, a
  blindfolded hostage; no blood or injury), which SingGuard's policies judge differently;
- **`C_lingerie.jpg` and `E_boudoir_robe.jpg`**, which SingGuard's general `default` policy can read as sexual
  content while the `adult*` policies do not;
- **`rejects/D_cafe_watermark.jpg`**, a frame with a "SAMPLE ©" box for the watermark detector, and
  **`rejects/BE_group_cafe.jpg`**, a two-person shot;
- **21 everyday, swim and gym frames**, so each of the five fictional people (`personA` to `personE`) has
  enough frames to form a face cluster.

Cull's blur, low-resolution, banner and near-duplicate rejects were left out: the photos above already cover
them. The people are fictional, written as adults of 27 to 30; none depicts a real person.

## The people

The people in these photos are real athletes photographed in public competition, released by their
photographers or institutions under CC0. The demo shows what the curator reads from the frames (clusters,
MiVOLO age bands, ratings); it names no one. The
synthetic people are fictional and have no names.

## The recorded scan

`scripts/record_curator_demo.py` sent `POST /scan/folder` to a throwaway `ghcr.io/smk762/argus-curator:0.18.0-gpu`
(`dev` at `b94d89b` is that release) with the set mounted at `/data/images`, its face, scene and garment models
leased from argus-iris, on 2026-11-21, then saved the `ScanSummary` verbatim and fetched each image's
`GET /thumb`. Options: photo / SDXL / identity target; min short side 512, max aspect 3.0, blur threshold 100,
pHash cluster distance 10; InsightFace `buffalo_l` faces with MiVOLO age and gender, clustered at a distance of
**0.8** (curator's default is 0.5; 0.8 is argus-cull's setting, at which each fictional person holds one cluster);
Places365 scenes; Fashionpedia garments; NudeNet (the imogen NudeNet server); watermark crops (`crops.detect`,
max cut 15%) with argus-retina's watermark detector 0.1.0 (the image and weights argus-cull runs); SingGuard
(`SingGuard-4b`, the Q4_K_M GGUF through Ollama on dragon) under the `adult` policy with the `default`,
`adult-granular`, `adult-cautious` and `adult-cinematic` variants, in cascade mode. SingGuard ran with one
worker and a 300 s timeout, and a scan whose log held a failed remote check would have been discarded; this one
had none. The detectors matter: retina's NudeNet 640m reports covered-chest detections differently from this
server, so swapping detectors can change the ratings and the recording.

What it found is what the page shows:

- **Rejects.** The blurred frame fails on sharpness (6 < 100) and the 160 px frame on resolution. The banner
  fails on a watermark: the detector found an overlay inside it that no edge cut of 15% removes, and the scan
  reports that reason rather than the 5:1 aspect ratio.
- **Watermarks.** The photographer's credit along the bottom of both volleyball frames and of
  `handball_b/02.jpg`, and Cull's "SAMPLE ©" box, are cut away by a detected crop; the frames pass on the crop.
  Two weaker hits (`handball_a/02.jpg`, `D_action_film.jpg`) were below the detector's confidence line and
  changed nothing.
- **Faces.** Each fictional person holds one main cluster (A and D seven frames, C and E six, B five; the
  group shot joins B's and E's), and two pairs of dark crime stills form small clusters of their own. The
  first handball player's three frames fall in one cluster (the third, in a different kit, may be a clustering
  error; it is the curator's real output), and the second player's, the volleyball player's and the skier's in
  one each. At 0.8 five faces in the crowd behind `handball_a/03.jpg` merge into one cluster: also real
  output. `skier/02_copy.jpg` is flagged as a near duplicate of `skier/02.jpg`.
- **Ages.** MiVOLO reads every face as an adult, from about 21 to 52 on the photos and 24.9 and up on the
  synthetic frames; the same person can read years apart between frames.
- **Nudity.** NudeNet rated 21 passing frames `suggestive` (sports kit, swimwear, lingerie, evening dresses)
  and 26 safe. It found no exposed female breast, genitalia or buttocks, so no frame is blurred for nudity;
  the shirtless men's `MALE_BREAST_EXPOSED` detections are not an exposed class. Rejected frames are always
  veiled.
- **SingGuard.** Every passing frame has a verdict under all five policies. Eleven frames are unsafe under at
  least one, and the page veils them until you reveal them:

  | Frame | adult | default | adult-granular | adult-cautious | adult-cinematic |
  |---|---|---|---|---|---|
  | `personA/A_heist_film.jpg` | B | | | B | |
  | `personA/A_noir_detective.jpg` | | | B | B | |
  | `personB/B_detective_film.jpg` | B | | B | B | |
  | `personB/B_drugdeal_film.jpg` | B | B | B | B | |
  | `personC/C_lingerie.jpg` | | A | | | |
  | `personC/C_rooftop_film.jpg` | B | | B | B | |
  | `personD/D_action_film.jpg` | B | | B | B | |
  | `personD/D_hostage_film.jpg` | | C | B | | B |
  | `personD/D_smuggler_film.jpg` | B | B | B | B | G |
  | `personE/E_getaway_film.jpg` | | | B | B | |
  | `personE/E_heist_film.jpg` | B | | B | B | |

  Letters are each policy's own rule (`default`'s A is sexual content and C unethical behaviour; the `adult*`
  policies' B is real-world crime and public safety, except `adult-cinematic`, whose B is unethical behaviour
  and G criminal instructions). Every other frame is safe under all five, including `C_spy_film.jpg` and
  `E_boudoir_robe.jpg`, which argus-cull's recording on curator 0.15.1 flagged: SingGuard is not
  deterministic across runs and builds, and this is what this run said.

## Licences

- **The synthetic frames:** argus-cull's demo set, made with CyberRealistic XL Desire v2.0 (CreativeML Open
  RAIL-M) and InstantID (Apache-2.0; its InsightFace antelopev2 face encoder has non-commercial research
  weights), so they are for this non-commercial demo only. See argus-cull's provenance for the full recipe.
- **The photographs:** CC0, as PD12M records each one (Spawning's PD12M keeps only CC0 and Public Domain Mark
  images). No attribution is required; the institution is named above as a courtesy.
- **Derived frames** (the photo near duplicate and the three photo rejects) are released under CC0 too.
- The scan and thumbnails ship with Argus Studio as demo data.
