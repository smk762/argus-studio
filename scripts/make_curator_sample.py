"""Build the real-photo image set behind the static /curate demo.

Every frame comes from PD12M (CC0) through argus-quarry's archive index: the
script asks quarry for each item (`GET /archives/pd12m/items/<id>`), downloads
the image from the URL quarry records, checks it against the sha256 pinned
below, and writes a curator-ready tree:

- the photos themselves, downscaled to at most 2048 px on the long side (a
  scan of much larger originals grew the curator's ONNX arena to fill the GPU);
- one near duplicate: a 2% crop of a kept frame, re-encoded;
- three rejects made from three other frames: a heavy blur, a 160 px-wide
  copy and a 5:1 banner cut from a 2.25x upscale (so only the aspect ratio
  fails, not the short side).

Each file is a fresh JPEG (quality 92) with no EXIF or XMP. It also writes
<out>/manifest.json: each file's PD12M id, institution, licence, caption,
source URL and sha256, and how it was derived.

    python3 scripts/make_curator_sample.py --quarry http://localhost:8102 --out ./curator-sample-set

Needs Pillow; quarry must have the pd12m archive indexed. Which frames were
chosen, and why, is in frontend/public/curator-sample/PROVENANCE.md.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import urllib.request
from dataclasses import dataclass
from pathlib import Path

MAX_SIDE = 2048
QUALITY = 92


@dataclass(frozen=True)
class Frame:
    rel: str  # path under the sample folder, without .jpg
    pd12m_id: str
    sha256: str  # of the image PD12M serves
    post: str = ""  # "", "copy", "blur", "lowres" or "banner"


FRAMES = [
    # One handball player (Wikimedia Commons), three frames: curator puts all three in one face cluster.
    Frame("handball_a/01", "dcdc8d02721d6a9d66949d917c1f1f71", "f64ec1453b1d3f9966c18b5b15493e5b36b2d2a3d2aefeddfba2322d0c827e8a"),
    Frame("handball_a/02", "84c403799ac4194c50a7e2de43631344", "006a43314c89a4ee609ad1634fb14b34e09379cb0014fb9a146e2a4b227b98dd"),
    Frame("handball_a/03", "a673dd30d9051f45c59c4e846f0c287b", "f9875719764095514e0b6bb2bda070a24d8b2c210a27d85422d352100dbd20ba"),
    # Another handball player, two frames.
    Frame("handball_b/01", "2bed74fb5e122ae117fa27e5a3e687f6", "c5ba543c52bb6f6bf5459ab8ba96fa33330ff33e21c8f30413ae1c6fe159a40e"),
    Frame("handball_b/02", "ec3e8c751205cff6789e9bfb146f4f81", "81c3cae0c30b496c1c75497dcfe1d8f3aeac9a7cabed2b25cc4469494ec9a07f"),
    # A volleyball player serving, two frames.
    Frame("volleyball/01", "35cfe2e5d8dae19ec21b019c2a532913", "b7611dff706a62a8dcc14d9b056435097afc6ba6141c343186acf57f6d259a31"),
    Frame("volleyball/02", "9f12f7f0e4a630e047f1e3ddd26f8718", "de0012c4c61038d7a2aa686a402ceff4d93e01d7a992e04e7ae313fe19bdf80a"),
    # A cross-country skier (Estonian Sports and Olympic Museum), two frames plus a near duplicate.
    Frame("skier/01", "1281368a97e4484c1014afc344189c25", "a6764365edcf83a707ff503a738e45762b3aae45da3f87574b7738d92f3c1c6a"),
    Frame("skier/02", "e3b09846f651f96b5daee7ad42de8064", "954b4e85c9644b2e32620945599eb8a91602076c7eea082421678b67a3355a2f"),
    Frame("skier/02_copy", "e3b09846f651f96b5daee7ad42de8064", "954b4e85c9644b2e32620945599eb8a91602076c7eea082421678b67a3355a2f", post="copy"),
    # A relay team together after their race.
    Frame("relay/group_shot", "43dae84e9f1380cf01e57aa878662a28", "ad53edf853fa46ad079e2c3fac91daeed87b93df0dd8644ed4caffd5c7555cfe"),
    # Rejects.
    Frame("rejects/blurry", "2e9ff3432b53c5628d2849e0a87c954f", "4ad1775b27ab39ccfd678d88a37076928c99ce91207bbaf5d13d2cd4d97810f9", post="blur"),
    Frame("rejects/lowres", "121d9531114127b8bf7c45dbdeeaccad", "116db4fa4ddf3c120794002b908ac5673e087213e6652042caf97f1efbbfe9c8", post="lowres"),
    Frame("rejects/wide_banner", "09dc65f4cb65d342991f2ed171b711e7", "e6952c4307c5fe00834842fcb88d892ca2c102d7d491c9af9d842e88c8c694f9", post="banner"),
]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--quarry", required=True, help="argus-quarry base URL")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    base = args.quarry.rstrip("/")

    from PIL import Image, ImageFilter, ImageOps

    def fetch(frame: Frame) -> tuple[dict, Image.Image]:
        with urllib.request.urlopen(f"{base}/archives/pd12m/items/{frame.pd12m_id}", timeout=60) as resp:
            item = json.load(resp)
        if item.get("licence") != "CC0":
            raise SystemExit(f"{frame.rel}: PD12M item {frame.pd12m_id} is {item.get('licence')!r}, not CC0")
        with urllib.request.urlopen(item["url"], timeout=120) as resp:
            data = resp.read()
        got = hashlib.sha256(data).hexdigest()
        if got != frame.sha256:
            raise SystemExit(f"{frame.rel}: {item['url']} has sha256 {got}, expected {frame.sha256}")
        img = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
        img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        return item, img

    def save(img: Image.Image, rel: str) -> None:
        dest = args.out / f"{rel}.jpg"
        dest.parent.mkdir(parents=True, exist_ok=True)
        # A fresh RGB buffer: no EXIF or XMP survives.
        Image.frombytes("RGB", img.size, img.tobytes()).save(dest, "JPEG", quality=QUALITY)

    manifest = {"source": "PD12M via argus-quarry", "max_side": MAX_SIDE, "quality": QUALITY, "frames": []}
    for frame in FRAMES:
        item, img = fetch(frame)
        if frame.post == "copy":
            dx, dy = round(img.width * 0.02), round(img.height * 0.02)
            img = img.crop((dx, dy, img.width - dx, img.height - dy))
        elif frame.post == "blur":
            img = img.filter(ImageFilter.GaussianBlur(8))
        elif frame.post == "lowres":
            img = img.resize((160, round(img.height * 160 / img.width)), Image.LANCZOS)
        elif frame.post == "banner":
            big = img.resize((round(img.width * 2.25), round(img.height * 2.25)), Image.LANCZOS)
            h = big.width // 5
            top = (big.height - h) // 2
            img = big.crop((0, top, big.width, top + h))
        save(img, frame.rel)
        manifest["frames"].append({
            "rel": f"{frame.rel}.jpg", "pd12m_id": frame.pd12m_id, "sha256": frame.sha256, "post": frame.post or None,
            "size": list(img.size), "licence": item["licence"], "collection": item["collection"],
            "url": item["url"], "caption": item["caption"],
        })
        print(f"{frame.rel}: {item['collection']}, {img.width}x{img.height}{' (' + frame.post + ')' if frame.post else ''}", flush=True)
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
