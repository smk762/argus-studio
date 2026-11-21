"""Build the image set behind the static /curate demo.

Two sources. The real photos come from PD12M (CC0) through argus-quarry's archive index: the
script asks quarry for each item (`GET /archives/pd12m/items/<id>`), downloads
the image from the URL quarry records, checks it against the sha256 pinned
below, and writes a curator-ready tree:

- the photos themselves, downscaled to at most 2048 px on the long side (a
  scan of much larger originals grew the curator's ONNX arena to fill the GPU);
- one near duplicate: a 2% crop of a kept frame, re-encoded;
- three rejects made from three other frames: a heavy blur, a 160 px-wide
  copy and a 5:1 banner cut from a 2.25x upscale (so only the aspect ratio
  fails, not the short side).

The synthetic frames are argus-cull's demo set (fictional adults, SDXL), taken
from an argus-cull checkout's tape (`web/public/data-tape/images/<id>.webp`,
the full 832x1216 renders) and written under `synthetic/`. They bring the
guard cases the sports photos lack: crime-film stills, lingerie and boudoir
frames `default` reads as sexual content, a watermark and a group shot.

Each file is a fresh JPEG (quality 92) with no EXIF or XMP. It also writes
<out>/manifest.json: each file's source, id, licence, sha256 and how it was
derived.

    python3 scripts/make_curator_sample.py --quarry http://localhost:8102 --cull ../argus-cull --out ./curator-sample-set

Needs Pillow; quarry must have the pd12m archive indexed, and the argus-cull
checkout must hold the tape the hashes below pin (dev at 42a08f1). Which frames were
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


@dataclass(frozen=True)
class CullFrame:
    rel: str  # path in argus-cull's demo set; written under synthetic/
    tape_id: str  # web/public/data-tape/images/<tape_id>.webp
    sha256: str  # of that WebP


CULL_FRAMES = [
    # Crime-film stills: SingGuard rule B under most policies, Safe (or G) under adult-cinematic.
    # Lingerie and a boudoir robe: rule A under default only. A watermark reject and a two-person group shot.
    # Everyday, swim and gym frames keep each fictional person in a face cluster.
    CullFrame("personA/A_beach_bikini.jpg", "e8ac3c8db0836a98", "d0716722429c6ba024944715fbd3e5ea19e1e55aa1e28235d72f07c594d3bed7"),
    CullFrame("personA/A_cafe.jpg", "9f8bdef32e02b8e3", "ec3493e2cd4d72ecc8880e641f9635b09f6fe383756a1a6da45559fc358fceae"),
    CullFrame("personA/A_gym_sportsbra.jpg", "248e79ab02281f4e", "6299535cad4e4020c243fa1c5d403594dbee736ae3ec305550b4f9200ff9e7e9"),
    CullFrame("personA/A_heist_film.jpg", "79713d88b818a79d", "9fb9014591a6675ef83408485bed9fdc724808847ce297beb521ae810db41142"),
    CullFrame("personA/A_noir_detective.jpg", "b3670d4eb3c64bf6", "5ed2149bb989d08d7961b0f167bde456e22796a3b1547b5d4b63b6b4962d24a2"),
    CullFrame("personA/A_office.jpg", "a64aaa90931bc87c", "1ddeffa7011d3e9e28cd37f83c8a037613670454666cf3b43956a6212c3a92f4"),
    CullFrame("personA/A_street.jpg", "28daa62cc7778645", "2f90da3a62e22cb54cda0f94f76a929ec89a6e1f35a7074e69a188417204b6b0"),
    CullFrame("personB/B_detective_film.jpg", "fab68ad5fa39eed8", "42698162c791e7dc6b0dadeb01ec99112902c192e364354254493681059c7baa"),
    CullFrame("personB/B_drugdeal_film.jpg", "6746984c68a81580", "a84c6f1eb0e4f5fd817d8b90c099f6736e12b669ae4af49a79c38b64a188c87c"),
    CullFrame("personB/B_gym_shirtless.jpg", "36aa15abf476dbe2", "93468113db656e65904aa7bc482290a63b28c6989e3af88efd026523fdc89ba6"),
    CullFrame("personB/B_kitchen.jpg", "d514250d9a100706", "e5ceb07c3d8c7f2f79beed9a9059746dab25bc3f63cb60dc7325fcab317b4349"),
    CullFrame("personB/B_park.jpg", "60d31b00d627b4cf", "2a2fafb5ab04c42d5b8bc8665aecfd9e4892940a703c9f4f138e426ae853b791"),
    CullFrame("personB/B_pool_shirtless.jpg", "e12d2a6c8697cce1", "c3e9b0f162da1fcd66838c3ac74f70e6611559e397dd8d6bac90662ebf4aad4b"),
    CullFrame("personC/C_cafe.jpg", "15837c84148e523c", "884cdec41d09bb4ef7035aed9beb71bf1be8411aeb7b21a80870c26115d8623a"),
    CullFrame("personC/C_evening_gown.jpg", "be089b3b37c62e08", "a5433944e98684288a0dcd5a1b1c90a72cd6bbf9b183c5d5b3167db211e291ad"),
    CullFrame("personC/C_lingerie.jpg", "7e8821d96f6c7d5a", "9c3c375e35b36806809e58be48a405039a6b162fbff9fbdf04446be75f4d993c"),
    CullFrame("personC/C_park.jpg", "4096104a5c93da38", "aa9050ebb689e0327ee2e7aa26ba8253147544289c4cbafdd59fdfdf2ddae1fe"),
    CullFrame("personC/C_pool_bikini.jpg", "ae32bb56d882854f", "0a126b80139571918a11e669bdbb996dd0323cf12dd9c2c8d7751e352a706310"),
    CullFrame("personC/C_rooftop_film.jpg", "5fdd32abaad3b3c7", "77ce278622219271237fb126e0e176aa00cdd01953d48568cf19a398505a3c01"),
    CullFrame("personC/C_spy_film.jpg", "3dfa071d5c4c41d9", "79f6191e0b3b8e4e48d5348cabf1a21d0617636d511c1d32b7328b9c73eb2c7e"),
    CullFrame("personD/D_action_film.jpg", "abde0009251ca209", "504cb9787b2092433eda3b73e998196682cd383c161a529d3ef313b211b7e665"),
    CullFrame("personD/D_beach_shirtless.jpg", "d4fee38a4ea564fa", "d3c9b3d5c1ed3483ab91a2450063e4055ecd6745e929bfa8d0a34e49965cb72f"),
    CullFrame("personD/D_cafe.jpg", "8179ae8ab54461b7", "e8d0fca72821628aaac286a971f785403dc3a918b7f2e2f34d898614b2c27c05"),
    CullFrame("personD/D_hostage_film.jpg", "cdc47dc5df637504", "8a505ad78a41dc466ef5bb5d43bbe0c3afd4fb391025ed1b164b1e04569d37ef"),
    CullFrame("personD/D_smuggler_film.jpg", "ffc733fcd4398862", "b015897196a33b12924c3c527a7ee5f1273e44e38d2e69d03fb09e2d2ada7dcc"),
    CullFrame("personD/D_street.jpg", "ae7ca415f83709d9", "dead77b48dfedce2bb17b61102ce83fc1c19f5983d45b6b5c41d45ca2e1bf05e"),
    CullFrame("personD/D_surf_shirtless.jpg", "4ae6fdfdccdc56c9", "90aaa3ae7d29b8ea89b23d2ae2942cecd18dc5cb139d5140dfcce6aee27524ab"),
    CullFrame("personE/E_beach_bikini.jpg", "4eda7444bcf433a9", "c187bee0149c6e4de0ac0cb446214c6d832eb1e4cf36fad566f1b73827e5d503"),
    CullFrame("personE/E_boudoir_robe.jpg", "006da8a4c5ca9f82", "17a1291c306ab4ec15f6fa1a96f42c215c279eaf90b9be1072e8ee3ad3ca8269"),
    CullFrame("personE/E_cafe.jpg", "d367fbadc7e52f45", "8866bbb72d1d8139fa9ec27467990f7585e0990152b880236a5365ccbad0373b"),
    CullFrame("personE/E_getaway_film.jpg", "bea8f17971bc8db8", "b65ebecacea8962a0d47130d650d01e83a0fe192d1385298f339dc3202b39a1f"),
    CullFrame("personE/E_heist_film.jpg", "774051ebfd182f05", "55463484fcdb290951d02443e5e4e1126d921376d01539fb1d9efb51b5630bc4"),
    CullFrame("personE/E_park.jpg", "61da1dc8cacaa5dc", "3ba8a96c4992c55e48999fb13bb81833e7acac0f99f05585fd2c3448779442a2"),
    CullFrame("personE/E_run_cropTop.jpg", "df63f5840dd90058", "218e2bbc837a6b822652946809f87e67db0da471da10e853ed94d42a1f7c44e2"),
    CullFrame("rejects/BE_group_cafe.jpg", "c752b37b5c0bd16a", "2a43baa269f0ffc8f89d6bea1ee547b964ae8d9af4a0a62df912956cf5ddba82"),
    CullFrame("rejects/D_cafe_watermark.jpg", "54ee8911d761e7ef", "470387b7c82edfe624351344f55ac6e81993ca975d1fdb95443351547f358bd7"),
]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--quarry", required=True, help="argus-quarry base URL")
    ap.add_argument("--cull", type=Path, required=True, help="an argus-cull checkout (its demo tape)")
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

    manifest = {"source": "PD12M via argus-quarry; argus-cull demo tape", "max_side": MAX_SIDE, "quality": QUALITY, "frames": []}
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
    tape = args.cull / "web/public/data-tape/images"
    for cf in CULL_FRAMES:
        data = (tape / f"{cf.tape_id}.webp").read_bytes()
        got = hashlib.sha256(data).hexdigest()
        if got != cf.sha256:
            raise SystemExit(f"{cf.rel}: {cf.tape_id}.webp has sha256 {got}, expected {cf.sha256}")
        img = Image.open(io.BytesIO(data)).convert("RGB")
        rel = f"synthetic/{cf.rel[:-4]}"
        save(img, rel)
        manifest["frames"].append({
            "rel": f"{rel}.jpg", "cull_tape_id": cf.tape_id, "sha256": cf.sha256, "post": None,
            "size": list(img.size), "licence": "synthetic (argus-cull demo set)", "collection": "argus-cull",
        })
        print(f"{rel}: argus-cull, {img.width}x{img.height}", flush=True)
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
