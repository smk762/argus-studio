"""bundle_atlas_demo.py must not lose data (audit pack-argus-studio-ef86bf4177).

argus-atlas is not installed where these run, so its JobStore is stubbed: the
tests cover what the script does around it, not the sidecar contract.
"""

from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path

import pytest


class Digest:
    def __init__(self, job_id: str) -> None:
        self.job_id = job_id

    def model_dump(self, mode: str = "json") -> dict[str, str]:
        return {"job_id": self.job_id}


class Sidecar:
    status = "done"
    controls: dict[str, object] = {}
    bake = None
    tiles = None

    def __init__(self, job_id: str) -> None:
        self.job_id = job_id

    def model_dump(self, mode: str = "json") -> dict[str, object]:
        return {"job_id": self.job_id, "commands": []}


class FakeStore:
    fail = False

    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    def list(self) -> list[Digest]:
        return [Digest(p.name) for p in sorted(self.root.iterdir())]

    def dir(self, job_id: str) -> Path:
        return self.root / job_id

    def load(self, job_id: str) -> Sidecar:
        if self.fail:
            raise RuntimeError("sidecar did not validate")
        return Sidecar(job_id)


@pytest.fixture
def bundle(monkeypatch: pytest.MonkeyPatch):
    package = types.ModuleType("argus_atlas")
    jobs = types.ModuleType("argus_atlas.jobs")
    jobs.JobStore = FakeStore
    monkeypatch.setitem(sys.modules, "argus_atlas", package)
    monkeypatch.setitem(sys.modules, "argus_atlas.jobs", jobs)
    monkeypatch.setattr(FakeStore, "fail", False)
    spec = importlib.util.spec_from_file_location("bundle_atlas_demo", Path(__file__).with_name("bundle_atlas_demo.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    def run(*argv: str) -> None:
        monkeypatch.setattr(sys, "argv", ["bundle_atlas_demo.py", *argv])
        module.main()

    return run


def job(tmp_path: Path, name: str = "j1") -> Path:
    path = tmp_path / "runs" / name
    path.mkdir(parents=True)
    (path / "sidecar.json").write_text("{}")
    return path


def old_bundle(tmp_path: Path) -> Path:
    out = tmp_path / "public" / "atlas"
    (out / "old").mkdir(parents=True)
    (out / "jobs.json").write_text("old")
    return out


def test_failed_run_keeps_the_old_bundle(bundle, tmp_path: Path) -> None:
    out = old_bundle(tmp_path)
    FakeStore.fail = True
    with pytest.raises(RuntimeError):
        bundle("--job", str(job(tmp_path)), "--out", str(out))
    assert (out / "jobs.json").read_text() == "old"
    assert (out / "old").is_dir()
    assert [p.name for p in out.parent.iterdir()] == ["atlas"]


@pytest.mark.parametrize("out", ["runs", "runs/j1", "runs/j1/bundle"])
def test_refuses_an_out_that_overlaps_a_job(bundle, tmp_path: Path, out: str) -> None:
    src = job(tmp_path)
    with pytest.raises(SystemExit):
        bundle("--job", str(src), "--out", str(tmp_path / out))
    assert (src / "sidecar.json").read_text() == "{}"


def test_replaces_the_old_bundle_once_every_job_is_written(bundle, tmp_path: Path) -> None:
    out = old_bundle(tmp_path)
    bundle("--job", str(job(tmp_path)), "--out", str(out))
    assert sorted(p.name for p in out.iterdir()) == ["j1", "jobs.json"]
    assert (out / "j1" / "job.json").is_file()
    assert [p.name for p in out.parent.iterdir()] == ["atlas"]


def test_writes_a_first_bundle(bundle, tmp_path: Path) -> None:
    out = tmp_path / "public" / "demo" / "atlas"
    bundle("--job", str(job(tmp_path)), "--out", str(out))
    assert (out / "jobs.json").is_file()
