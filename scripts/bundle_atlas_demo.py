"""Bundle recorded argus-atlas jobs for the static demo (frontend/public/demo/atlas/).

Run with an interpreter that has argus-atlas installed (the sidecar contract is
read and re-served through argus-atlas's own JobStore, so the bundled JSON is
exactly what GET /jobs and GET /jobs/{id} would return for these jobs):

    ~/argus-atlas/.venv/bin/python scripts/bundle_atlas_demo.py \
        --job /maps/areas/iceland/antique/antique-7-56-34 \
        --job /maps/areas/reunion/tolkien/tolkien-11-1339-1146 --archive

Writes jobs.json, <id>/job.json, every control and the painted image as WebP
(re-encoded with ImageMagick from the job's own PNGs, same pixel grid), the
job's labels.geojson when it has place names (what GET /jobs/{id}/labels
serves), and fantasy.pmtiles only for jobs passed with --archive.

Absolute paths in the sidecar are host details, not part of the demo: paths
inside the job dir become relative to it, sibling chunks become ../<job>/...,
inputs under --inputs-root become relative to it (as POST /controls names
them), and anything else is cut to its file name.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from argus_atlas.jobs import JobStore


def scrub_paths(node: Any, job_dir: str, inputs_root: str) -> Any:
    """Rewrite every absolute path string in a dumped sidecar (see the module docstring)."""
    if isinstance(node, dict):
        return {k: scrub_paths(v, job_dir, inputs_root) for k, v in node.items()}
    if isinstance(node, list):
        return [scrub_paths(v, job_dir, inputs_root) for v in node]
    if not (isinstance(node, str) and node.startswith("/")):
        return node
    if job_dir and node.startswith(job_dir + "/"):
        return node[len(job_dir) + 1 :]
    parent = job_dir.rsplit("/", 1)[0] if job_dir else ""
    if parent and node.startswith(parent + "/"):
        return "../" + node[len(parent) + 1 :]
    if node.startswith(inputs_root + "/"):
        return node[len(inputs_root) + 1 :]
    return Path(node).name


def recorded_dir(sidecar: dict[str, Any]) -> str:
    """Where the job dir sat on the recording host, found in its own GDAL argv ("" if never named)."""
    marker = f"/{sidecar['job_id']}/"
    for cmd in sidecar.get("commands") or []:
        for arg in cmd.get("argv") or []:
            if isinstance(arg, str) and arg.startswith("/") and marker in arg:
                return arg[: arg.index(marker) + len(marker) - 1]
    return ""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--job", action="append", required=True, help="a job dir (repeatable)")
    ap.add_argument("--archive", action="store_true", help="also bundle the PMTiles of the --job before it")
    ap.add_argument("--out", default="frontend/public/demo/atlas")
    ap.add_argument("--quality", type=int, default=72, help="WebP quality of the painted image")
    ap.add_argument("--control-quality", type=int, default=50, help="WebP quality of the GDAL controls")
    ap.add_argument("--inputs-root", default="/data/dem", help="the recording host's ATLAS_DEM_DIR")
    args = ap.parse_args()

    # --archive applies to the --job just before it.
    raw = sys.argv[1:]
    with_archive: set[str] = set()
    last = None
    for i, tok in enumerate(raw):
        if tok == "--job" and i + 1 < len(raw):
            last = Path(raw[i + 1]).name
        elif tok.startswith("--job="):
            last = Path(tok.split("=", 1)[1]).name
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
            dumped = sidecar.model_dump(mode="json")
            dumped = scrub_paths(dumped, recorded_dir(dumped), args.inputs_root.rstrip("/"))
            envelope = {"job_id": sidecar.job_id, "status": sidecar.status, "sidecar": dumped}
            (dst / "job.json").write_text(json.dumps(envelope))
            labels = store.labels_path(d.job_id) if hasattr(store, "labels_path") else None
            if labels is not None:
                shutil.copy2(labels, dst / "labels.geojson")
            kinds = dict(sidecar.controls)
            if sidecar.bake:
                kinds["fantasy"] = sidecar.bake.image
            for kind, ref in kinds.items():
                # ImageMagick, so the script needs nothing beyond argus-atlas's own venv.
                quality = args.quality if kind == "fantasy" else args.control_quality
                subprocess.run(
                    ["magick", str(src / ref.path), "-quality", str(quality),
                     "-define", "webp:method=6", str(dst / f"{kind}.webp")],
                    check=True,
                )
            if d.job_id in with_archive and sidecar.tiles:
                shutil.copy2(src / sidecar.tiles.archive.path, dst / "fantasy.pmtiles")


if __name__ == "__main__":
    main()
