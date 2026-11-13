"""Bundle recorded argus-atlas jobs for the static demo (frontend/public/demo/atlas/).

Run with an interpreter that has argus-atlas installed (the sidecar contract is
read and re-served through argus-atlas's own JobStore, so the bundled JSON is
exactly what GET /jobs and GET /jobs/{id} would return for these jobs):

    ~/argus-atlas/.venv/bin/python scripts/bundle_atlas_demo.py \
        --job /maps/antique/antique-10-1007-640 --archive \
        --job /maps/tolkien/tolkien-10-1007-640

Writes jobs.json, <id>/job.json, every control and the painted image as WebP
(re-encoded with ImageMagick from the job's own PNGs, same pixel grid), and fantasy.pmtiles
only for jobs passed with --archive.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from argus_atlas.jobs import JobStore


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--job", action="append", required=True, help="a job dir (repeatable)")
    ap.add_argument("--archive", action="store_true", help="also bundle the PMTiles of the --job before it")
    ap.add_argument("--out", default="frontend/public/demo/atlas")
    ap.add_argument("--quality", type=int, default=72)
    args = ap.parse_args()

    # --archive applies to the --job just before it.
    raw = sys.argv[1:]
    with_archive: set[str] = set()
    last = None
    for i, tok in enumerate(raw):
        if tok == "--job":
            last = Path(raw[i + 1]).name
        elif tok == "--archive" and last:
            with_archive.add(last)

    out = Path(args.out)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for job in args.job:
            (root / Path(job).name).symlink_to(Path(job).resolve(), target_is_directory=True)
        store = JobStore(root)
        digests = store.list()
        (out / "jobs.json").write_text(json.dumps({"jobs": [d.model_dump(mode="json") for d in digests]}))
        for d in digests:
            src = store.dir(d.job_id)
            sidecar = store.load(d.job_id)
            dst = out / d.job_id
            dst.mkdir()
            envelope = {"job_id": sidecar.job_id, "status": sidecar.status, "sidecar": sidecar.model_dump(mode="json")}
            (dst / "job.json").write_text(json.dumps(envelope))
            kinds = dict(sidecar.controls)
            if sidecar.bake:
                kinds["fantasy"] = sidecar.bake.image
            for kind, ref in kinds.items():
                # ImageMagick, so the script needs nothing beyond argus-atlas's own venv.
                subprocess.run(
                    ["magick", str(src / ref.path), "-quality", str(args.quality),
                     "-define", "webp:method=6", str(dst / f"{kind}.webp")],
                    check=True,
                )
            if d.job_id in with_archive and sidecar.tiles:
                shutil.copy2(src / sidecar.tiles.archive.path, dst / "fantasy.pmtiles")


if __name__ == "__main__":
    main()
