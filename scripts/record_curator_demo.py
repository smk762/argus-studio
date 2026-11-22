"""Record a real argus-curator scan for the static /curate demo (frontend/public/curator-sample/).

Point it at a running argus-curator whose image mount holds the sample set
(see frontend/public/curator-sample/PROVENANCE.md), e.g. a throwaway
`ghcr.io/smk762/argus-curator:0.20.0-gpu` container with the set mounted at
/data/images and ARGUS_CURATOR_PUPPET_URL naming an argus-puppet server:

    python3 scripts/record_curator_demo.py --curator http://127.0.0.1:8100 --folder /data/images

It sends POST /scan/folder with the scan options below (faces + MiVOLO at a
0.8 clustering distance, Places365 scenes, Fashionpedia garments, NudeNet,
watermark crops, body pose from argus-puppet, SingGuard under the adult policy with the default,
adult-granular, adult-cautious and adult-cinematic variants), saves the ScanSummary verbatim as
scan.json, fetches every result's GET /thumb (the curator's own WebP
thumbnail) into thumbs/<rel_path>.webp, records the curator's GET /health
version in recording.json (checked against frontend/schema/demo.json by
src/lib/demoRecordings.test.ts), and writes the thumbnails' pixel sizes to
frontend/src/lib/curatorSampleThumbs.ts (read by lib/curatorSample.ts) so
the demo can give each <img> an explicit width and height. Stdlib only.
"""

from __future__ import annotations

import argparse
import datetime
import json
import shutil
import struct
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "public" / "curator-sample"
DIMS = ROOT / "frontend" / "src" / "lib" / "curatorSampleThumbs.ts"

SCAN_OPTIONS = {
    "target_profile": {"target_style": "photo", "target_backend": "sdxl", "target_category": "identity"},
    "config": {"min_short_side": 512, "max_aspect_ratio": 3.0, "blur_threshold": 100.0, "cluster_distance": 10},
    # 0.8, not curator's 0.5: the synthetic people only hold one cluster each from about 0.8 (argus-cull's tuning).
    "faces": {"enabled": True, "model": "buffalo_l", "mivolo": True, "cluster_eps": 0.8},
    "scenes": {"enabled": True, "top_k": 5},
    "garments": {"enabled": True, "min_conf": 0.3},
    "nsfw": {"enabled": True},
    "crops": {"enabled": True, "sidecars": True, "boxes": {}, "detect": True, "min_conf": 0.4, "max_cut": 0.15, "margin": 4, "reject_overlay": True},
    # Required, not left to the server: a curator without ARGUS_CURATOR_PUPPET_URL refuses the scan (400).
    "pose": {"enabled": True},
    "guard": {
        "enabled": True,
        "policy": "adult",
        "variants": ["default", "adult-granular", "adult-cautious", "adult-cinematic"],
    },
}


def webp_size(data: bytes) -> tuple[int, int]:
    """Width and height of a WebP (VP8, VP8L or VP8X) from its header."""
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ValueError("not a WebP")
    chunk = data[12:16]
    if chunk == b"VP8X":
        w = int.from_bytes(data[24:27], "little") + 1
        h = int.from_bytes(data[27:30], "little") + 1
        return w, h
    if chunk == b"VP8 ":
        w, h = struct.unpack("<HH", data[26:30])
        return w & 0x3FFF, h & 0x3FFF
    if chunk == b"VP8L":
        b = int.from_bytes(data[21:25], "little")
        return (b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1
    raise ValueError(f"unknown WebP chunk {chunk!r}")


def thumb_dest(thumbs: Path, rel: str) -> Path:
    """Where a row's thumbnail goes: under `thumbs`, never outside it.

    `rel` comes from the curator's response, so an absolute path or a `..`
    segment (from a misconfigured or hostile server) is refused rather than
    written wherever it points.
    """
    rel_path = PurePosixPath(rel)
    if not rel_path.parts or rel_path.is_absolute() or "\\" in rel or ".." in rel_path.parts:
        raise ValueError(f"refusing unsafe rel_path from the curator: {rel!r}")
    dest = (thumbs / Path(*rel_path.parts)).with_suffix(".webp")
    root = thumbs.resolve()
    if not dest.resolve().is_relative_to(root):
        raise ValueError(f"refusing rel_path outside the thumbs dir: {rel!r}")
    return dest


def fetch_thumbs(summary: dict, staging: Path, fetch) -> dict[str, tuple[int, int]]:
    """Fetch every result's thumbnail into `staging`; return each one's pixel size.

    `fetch(rel)` returns the WebP bytes. Any failure (a request, a header, a
    collision) raises before the live thumbs/ directory is touched.
    """
    dims: dict[str, tuple[int, int]] = {}
    written: dict[Path, str] = {}
    for row in summary["results"]:
        rel = row["rel_path"]
        dest = thumb_dest(staging, rel)
        # a/foo.jpg and a/foo.png would both become a/foo.webp: refuse rather
        # than let the second overwrite the first under two manifest keys.
        if dest in written:
            raise SystemExit(f"thumbnail collision: {written[dest]!r} and {rel!r} both map to {dest.relative_to(staging)}")
        written[dest] = rel
        data = fetch(rel)
        dims[rel] = webp_size(data)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
    return dims


def record_thumbs(summary: dict, out: Path, fetch) -> dict[str, tuple[int, int]]:
    """Replace out/thumbs with the new recording's thumbnails, all or nothing.

    The new set is staged in a sibling directory (same filesystem, so the swap
    is a rename) and only replaces the old one once every thumbnail arrived: a
    failed run leaves the committed thumbs/, scan.json and recording.json as
    they were, still describing each other.
    """
    out.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".thumbs-", dir=out))
    try:
        dims = fetch_thumbs(summary, staging, fetch)
        thumbs = out / "thumbs"
        if thumbs.exists():
            shutil.rmtree(thumbs)
        staging.rename(thumbs)
        return dims
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--curator", required=True, help="argus-curator base URL")
    ap.add_argument("--folder", default="/data/images", help="sample folder as the curator sees it")
    args = ap.parse_args()
    base = args.curator.rstrip("/")
    with urllib.request.urlopen(f"{base}/health", timeout=30) as resp:
        health = json.load(resp)

    body = json.dumps({"folder": args.folder, **SCAN_OPTIONS}).encode()
    req = urllib.request.Request(f"{base}/scan/folder", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=1800) as resp:
        summary = json.load(resp)

    def fetch(rel: str) -> bytes:
        q = urllib.parse.urlencode({"path": rel, "scan_id": summary["scan_id"]})
        with urllib.request.urlopen(f"{base}/thumb?{q}", timeout=120) as resp:
            return resp.read()

    # Thumbnails first, staged: scan.json, recording.json and the DIMS module
    # are written only once every thumbnail is in place.
    dims = record_thumbs(summary, OUT, fetch)

    (OUT / "scan.json").write_text(json.dumps(summary, indent=2) + "\n")
    recording = {
        "package": "argus-curator",
        "version": health.get("version"),
        "recorded_at": datetime.date.today().isoformat(),
        "options": SCAN_OPTIONS,
    }
    (OUT / "recording.json").write_text(json.dumps(recording, indent=2) + "\n")
    lines = [
        "// Generated by scripts/record_curator_demo.py: the pixel size of each bundled",
        "// curator thumbnail (public/curator-sample/thumbs/), keyed by the scan's rel_path,",
        "// and the curator version that made the scan (its GET /health).",
        f"export const CURATOR_SAMPLE_VERSION = {json.dumps(health.get('version'))};",
        "",
        "export const CURATOR_SAMPLE_THUMBS: Readonly<Record<string, readonly [number, number]>> = {",
        *(f"  {json.dumps(rel)}: [{w}, {h}]," for rel, (w, h) in sorted(dims.items())),
        "};",
        "",
    ]
    DIMS.write_text("\n".join(lines))
    print(f"argus-curator {health.get('version')} scan {summary['scan_id']}: {summary['total']} images, {summary['passed']} passed, {len(dims)} thumbs")


if __name__ == "__main__":
    main()
