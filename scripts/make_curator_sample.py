"""Generate the synthetic image set behind the static /curate demo.

Rebuilds the 14 images that frontend/public/curator-sample/PROVENANCE.md
describes: two fictional people, a group shot, a near duplicate and three
deliberate rejects. Everything runs in diffusers, so one run of this script is
the whole recipe:

1. Text render: SDXL, CyberRealistic XL Desire v2.0, DPM++ 2M SDE Karras,
   30 steps, CFG 5.0, at the seed in SHOTS.
2. Identity pass: InstantID (IdentityNet ControlNet + IP-Adapter, scale 0.8).
   The face embedding comes from one synthetic reference per person and the
   head pose from the frame's own text render, so each person keeps one face
   across frames. A frame whose text render shows no detectable face (a
   strict profile, a tiny figure) keeps its text render; the manifest says so.
3. Group shot: each face of the text render is re-rendered the same way in a
   crop around it and blended back with a feathered mask.
4. Near duplicate, rejects and clean-up: 02_copy repeats 02's identity pass at
   CFG 5.3; blur radius 8, a 160 px-wide downscale and a 5:1 crop of a 2.25x
   Lanczos upscale make the rejects; every file is a fresh JPEG (quality 90)
   with no metadata.

It writes <out>/<rel_path>.jpg and <out>/manifest.json (every prompt, seed and
whether the identity pass applied). Run it in a throwaway GPU container with
diffusers and insightface, the InstantID weights and the checkpoint mounted:

    docker run --rm --gpus all --entrypoint python \\
      -v /srv/imogen/models/instantid:/instantid:ro \\
      -v <dir holding cyberrealisticXL_desireV20.safetensors>:/ckpt:ro \\
      -v "$PWD/scripts":/scripts:ro -v <out dir>:/out \\
      <image with diffusers 0.39 + insightface> /scripts/make_curator_sample.py \\
      --instantid /instantid --ckpt /ckpt/cyberrealisticXL_desireV20.safetensors --out /out

/instantid must hold InstantX's pipeline_stable_diffusion_xl_instantid.py and
ip_adapter/, ControlNetModel/, ip-adapter.bin and models/antelopev2/.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

PERSON_A = (
    "a fictional 36 year old woman, mature adult face, fine laugh lines at the corners of her eyes, oval face, "
    "light freckles, green-grey eyes, shoulder-length wavy auburn hair, small silver stud earrings"
)
PERSON_B = (
    "a fictional 45 year old man, square jaw, short salt-and-pepper hair, neatly trimmed greying beard, "
    "warm brown eyes, faint smile lines"
)
TAIL = "professional photograph, natural skin texture, realistic, 85mm lens, sharp focus, soft light"
NEGATIVE = (
    "nude, nsfw, topless, cleavage, lingerie, underwear, sexy, celebrity, famous person, cartoon, anime, painting, "
    "illustration, 3d render, cgi, deformed, disfigured, extra fingers, bad hands, watermark, text, logo, signature, "
    "frame, low quality, worst quality"
)
NEGATIVE_A = NEGATIVE + ", teenager, young girl, childlike"
PERSONS = {"A": PERSON_A, "B": PERSON_B}

PORTRAIT = (832, 1216)
LANDSCAPE = (1216, 832)
STEPS = 30
CFG = 5.0
ID_SCALE = 0.8

A_STUDIO = "wearing an elegant burgundy dress, looking directly at the camera, head and shoulders portrait, in a theatre dressing room with a lit mirror behind her"
A_STUDIO_34 = "wearing an elegant burgundy dress, three-quarter view, face turned slightly to the side, upper body portrait, in a theatre dressing room with a lit mirror"
A_PARK = "wearing a denim jacket over a white t-shirt, looking at the camera, smiling, upper body portrait, outdoors in a green city park, trees behind her, daylight"
A_PARK_PROFILE = "wearing a denim jacket over a white t-shirt, side profile view looking to the left, upper body, outdoors in a green city park, autumn trees, daylight"
A_BEACH = "wearing a modest navy one-piece swimsuit, standing on a sandy beach, waist-up portrait, ocean and sky behind her, summer daylight, wholesome holiday photo"
B_TV = "wearing a navy blazer over a light blue shirt, looking directly at the camera, head and shoulders portrait, in a television studio with studio lights and screens behind him"
B_TV_34 = "wearing a navy blazer over a light blue shirt, three-quarter view, upper body portrait, seated in a television studio set"
B_STREET = "wearing a brown leather jacket, looking at the camera, upper body portrait, outdoors on a city street, daylight"
B_STREET_PROFILE = "wearing a brown leather jacket, side profile view looking to the right, upper body, outdoors on a city street, daylight"
BANNER = "small in frame, walking along a wide beach promenade at sunset, wide landscape shot"
# Short on purpose: CLIP reads 77 tokens, and both people must fit in them.
GROUP = (
    "medium shot of two colleagues standing a step apart in a green city park, a woman with wavy auburn hair "
    "in a green cardigan, a 45 year old man with a greying beard in a navy blazer, both smiling, daylight"
)
GROUP_SEED_TRIES = 12  # from GROUP_SEED upward, until the render shows two faces


@dataclass(frozen=True)
class Shot:
    rel: str  # path under the sample folder, without .jpg
    person: str  # "A" or "B"
    scene: str
    seed: int  # text render
    id_seed: int | None  # identity pass; None keeps the text render
    size: tuple[int, int] = PORTRAIT
    id_cfg: float = CFG
    post: str = ""  # "", "blur", "lowres" or "banner"


# The identity references come first: every other frame of a person takes its face from them.
REF_A = Shot("_refs/A2_ref_1", "A", A_PARK.replace("smiling, ", ""), 7701, None)
REF_B = Shot("_refs/B_tv_front_1", "B", B_TV, 2201, None)

SHOTS = [
    Shot("personA/studio/01", "A", A_STUDIO, 1101, 51101),
    Shot("personA/studio/02", "A", A_STUDIO_34, 1110, 51110),
    Shot("personA/studio/02_copy", "A", A_STUDIO_34, 1110, 51110, id_cfg=5.3),
    Shot("personA/outdoor/03", "A", A_PARK, 1120, 51120),
    Shot("personA/outdoor/04", "A", A_PARK_PROFILE, 1131, 51131),
    Shot("personA/outdoor/05", "A", A_BEACH, 1150, 51150),
    Shot("personB/set1/01", "B", B_TV, 2201, 52201),
    Shot("personB/set1/02", "B", B_TV_34, 2210, 52210),
    Shot("personB/set2/03", "B", B_STREET, 2220, 52220),
    Shot("personB/set2/04", "B", B_STREET_PROFILE, 2230, 52230),
    Shot("personB/rejects/blurry", "B", B_TV_34, 2211, None, post="blur"),
    Shot("personA/rejects/lowres", "A", A_PARK, 1121, 51121, post="lowres"),
    Shot("misc/wide_banner", "A", BANNER, 4400, 54400, size=LANDSCAPE, post="banner"),
]
GROUP_SHOT = "mixed/group_shot"
GROUP_SEED = 3300
GROUP_ID_SEEDS = {"A": 61000, "B": 61001}


def prompt_for(person: str, scene: str) -> str:
    return f"{PERSONS[person]}, {scene}, {TAIL}"


def negative_for(person: str) -> str:
    return NEGATIVE_A if person == "A" else NEGATIVE


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--instantid", type=Path, required=True)
    ap.add_argument("--ckpt", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--only", choices=["group"], help="re-make just the group shot (the references are re-rendered for its faces)")
    args = ap.parse_args()

    sys.path.insert(0, str(args.instantid))
    import cv2
    import numpy as np
    import torch
    from diffusers import (
        ControlNetModel,
        DPMSolverMultistepScheduler,
        StableDiffusionXLPipeline,
    )
    from insightface.app import FaceAnalysis
    from PIL import Image, ImageDraw, ImageFilter
    from pipeline_stable_diffusion_xl_instantid import (
        StableDiffusionXLInstantIDPipeline,
        draw_kps,
    )

    faces = FaceAnalysis(name="antelopev2", root=str(args.instantid), providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
    faces.prepare(ctx_id=0, det_size=(640, 640))

    base = StableDiffusionXLPipeline.from_single_file(str(args.ckpt), torch_dtype=torch.float16)
    # DPM++ 2M SDE Karras.
    base.scheduler = DPMSolverMultistepScheduler.from_config(
        base.scheduler.config, algorithm_type="sde-dpmsolver++", use_karras_sigmas=True
    )
    base.to("cuda")
    controlnet = ControlNetModel.from_pretrained(str(args.instantid / "ControlNetModel"), torch_dtype=torch.float16)
    ident = StableDiffusionXLInstantIDPipeline(**base.components, controlnet=controlnet)
    ident.to("cuda")
    ident.load_ip_adapter_instantid(str(args.instantid / "ip-adapter.bin"))
    ident.set_ip_adapter_scale(ID_SCALE)

    def text_render(person: str, scene: str, seed: int, size: tuple[int, int], prompt: str | None = None) -> Image.Image:
        g = torch.Generator("cuda").manual_seed(seed)
        return base(
            prompt=prompt or prompt_for(person, scene), negative_prompt=negative_for(person), width=size[0], height=size[1],
            num_inference_steps=STEPS, guidance_scale=CFG, generator=g,
        ).images[0]

    def largest_face(img: Image.Image):
        found = faces.get(cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR))
        return max(found, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])) if found else None

    def identity_pass(pose: Image.Image, face, emb, person: str, scene: str, seed: int, cfg: float) -> Image.Image:
        g = torch.Generator("cuda").manual_seed(seed)
        return ident(
            prompt=prompt_for(person, scene), negative_prompt=negative_for(person),
            image_embeds=emb, image=draw_kps(pose, face.kps), controlnet_conditioning_scale=ID_SCALE,
            width=pose.width, height=pose.height, num_inference_steps=STEPS, guidance_scale=cfg, generator=g,
        ).images[0]

    def save(img: Image.Image, rel: str) -> None:
        dest = args.out / f"{rel}.jpg"
        dest.parent.mkdir(parents=True, exist_ok=True)
        # A fresh RGB buffer: no EXIF, XMP or workflow metadata survives.
        Image.frombytes("RGB", img.size, img.convert("RGB").tobytes()).save(dest, "JPEG", quality=90)

    manifest: dict = {
        "checkpoint": args.ckpt.name, "sampler": "DPM++ 2M SDE Karras", "steps": STEPS, "cfg": CFG,
        "identity_scale": ID_SCALE, "negative": NEGATIVE, "negative_person_a": NEGATIVE_A, "shots": [],
    }

    embeddings = {}
    for ref in (REF_A, REF_B):
        img = text_render(ref.person, ref.scene, ref.seed, ref.size)
        face = largest_face(img)
        if face is None:
            raise SystemExit(f"no face in the reference {ref.rel}: pick another seed")
        embeddings[ref.person] = face.embedding
        save(img, ref.rel)
        manifest["shots"].append({"rel": ref.rel, "prompt": prompt_for(ref.person, ref.scene), "seed": ref.seed, "identity": "reference"})

    for shot in [] if args.only else SHOTS:
        text = text_render(shot.person, shot.scene, shot.seed, shot.size)
        face = largest_face(text) if shot.id_seed is not None else None
        img = identity_pass(text, face, embeddings[shot.person], shot.person, shot.scene, shot.id_seed, shot.id_cfg) if face is not None else text
        identity = f"seed {shot.id_seed}, CFG {shot.id_cfg}" if face is not None else ("none" if shot.id_seed is None else "skipped: no face in the text render")
        if shot.post == "blur":
            img = img.filter(ImageFilter.GaussianBlur(8))
        elif shot.post == "lowres":
            img = img.resize((160, round(img.height * 160 / img.width)), Image.LANCZOS)
        elif shot.post == "banner":
            big = img.resize((round(img.width * 2.25), round(img.height * 2.25)), Image.LANCZOS)
            h = big.width // 5
            top = (big.height - h) // 2
            img = big.crop((0, top, big.width, top + h))
        save(img, shot.rel)
        manifest["shots"].append({
            "rel": shot.rel, "prompt": prompt_for(shot.person, shot.scene), "seed": shot.seed,
            "identity": identity, "post": shot.post or None, "size": list(img.size),
        })
        print(f"{shot.rel}: identity {identity}", flush=True)

    # Group shot: re-render each face in a square crop around it and feather it back in.
    for group_seed in range(GROUP_SEED, GROUP_SEED + GROUP_SEED_TRIES):
        group = text_render("A", "", group_seed, LANDSCAPE, prompt=f"{GROUP}, {TAIL}")
        found = faces.get(cv2.cvtColor(np.array(group), cv2.COLOR_RGB2BGR))
        found = sorted(found, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)[:2]
        genders = sorted(int(f.gender) for f in found)
        if genders == [0, 1]:  # one woman, one man
            break
        print(f"{GROUP_SHOT}: seed {group_seed} shows {len(found)} face(s), genders {genders}; next seed", flush=True)
    else:
        raise SystemExit(f"no two-person group render in seeds {GROUP_SEED}..{GROUP_SEED + GROUP_SEED_TRIES - 1}")
    blended = group.copy()
    group_faces = []
    for f in found:
        person = "B" if int(f.gender) == 1 else "A"
        x0, y0, x1, y1 = f.bbox
        # A tight crop, so the re-render replaces the head and little else.
        cx, cy, side = (x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, y1 - y0) * 1.6
        box = tuple(int(v) for v in (max(0, cx - side / 2), max(0, cy - side / 2), min(group.width, cx + side / 2), min(group.height, cy + side / 2)))
        crop = group.crop(box).resize((1024, 1024), Image.LANCZOS)
        crop_face = largest_face(crop)
        if crop_face is None:
            group_faces.append({"person": person, "identity": "skipped: no face in the crop"})
            continue
        scene = "head and shoulders portrait, in a green city park, daylight, " + ("wearing a green cardigan" if person == "A" else "wearing a navy blazer")
        redone = identity_pass(crop, crop_face, embeddings[person], person, scene, GROUP_ID_SEEDS[person], CFG)
        redone = redone.resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS)
        # Feather in only the face itself (its box inside the crop), not hair, clothes or background.
        fx0, fy0, fx1, fy1 = (v - o for v, o in zip((x0, y0, x1, y1), (box[0], box[1], box[0], box[1])))
        pad = (fx1 - fx0) * 0.08
        mask = Image.new("L", redone.size, 0)
        ImageDraw.Draw(mask).ellipse(tuple(float(v) for v in (fx0 - pad, fy0 - pad, fx1 + pad, fy1 + pad)), fill=255)
        blended.paste(redone, box[:2], mask.filter(ImageFilter.GaussianBlur(int(max(4, (fx1 - fx0) // 10)))))
        group_faces.append({"person": person, "identity": f"seed {GROUP_ID_SEEDS[person]}", "box": list(box)})
    save(blended, GROUP_SHOT)
    group_entry = {"rel": GROUP_SHOT, "prompt": f"{GROUP}, {TAIL}", "seed": group_seed, "faces": group_faces}
    print(f"{GROUP_SHOT}: seed {group_seed}, {len(group_faces)} faces {group_faces}", flush=True)

    path = args.out / "manifest.json"
    if args.only and path.exists():
        manifest = json.loads(path.read_text())
        manifest["shots"] = [s for s in manifest["shots"] if s["rel"] != GROUP_SHOT]
    manifest["shots"].append(group_entry)
    path.write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
