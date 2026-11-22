"""record_curator_demo.py keeps the demo bundle consistent (audit pack-argus-studio-623a93c538).

The thumbnails are staged and swapped in only once all of them arrived, so a
run that fails partway leaves the committed thumbs/ untouched.
"""

from __future__ import annotations

import importlib.util
import struct
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("record_curator_demo", Path(__file__).with_name("record_curator_demo.py"))
rec = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rec)


def webp(w: int, h: int) -> bytes:
    """A minimal VP8 header webp_size can read."""
    return b"RIFF" + b"\0" * 4 + b"WEBP" + b"VP8 " + b"\0" * 10 + struct.pack("<HH", w, h)


def summary(*rels: str) -> dict:
    return {"scan_id": "s1", "results": [{"rel_path": r} for r in rels]}


def old_bundle(out: Path) -> Path:
    old = out / "thumbs" / "old.webp"
    old.parent.mkdir(parents=True)
    old.write_bytes(b"old")
    return old


def test_failed_fetch_leaves_the_old_thumbs(tmp_path: Path) -> None:
    old = old_bundle(tmp_path)

    def fetch(rel: str) -> bytes:
        if rel == "b.jpg":
            raise OSError("thumb request timed out")
        return webp(10, 20)

    with pytest.raises(OSError):
        rec.record_thumbs(summary("a.jpg", "b.jpg"), tmp_path, fetch)
    assert old.read_bytes() == b"old"
    assert sorted(p.name for p in (tmp_path / "thumbs").iterdir()) == ["old.webp"]
    assert [p.name for p in tmp_path.iterdir()] == ["thumbs"]  # no staging left behind


def test_collision_leaves_the_old_thumbs(tmp_path: Path) -> None:
    old = old_bundle(tmp_path)
    with pytest.raises(SystemExit):
        rec.record_thumbs(summary("a/foo.jpg", "a/foo.png"), tmp_path, lambda rel: webp(1, 1))
    assert old.exists()


def test_success_replaces_the_thumbs(tmp_path: Path) -> None:
    old_bundle(tmp_path)
    dims = rec.record_thumbs(summary("a.jpg", "sub/b.jpg"), tmp_path, lambda rel: webp(10, 20))
    assert dims == {"a.jpg": (10, 20), "sub/b.jpg": (10, 20)}
    assert sorted(str(p.relative_to(tmp_path / "thumbs")) for p in (tmp_path / "thumbs").rglob("*.webp")) == ["a.webp", "sub/b.webp"]
    assert [p.name for p in tmp_path.iterdir()] == ["thumbs"]


# Audit pack-argus-studio-a521955191: the swap never leaves no thumbs/, or half of one.
def test_failed_install_puts_the_old_thumbs_back(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    old = old_bundle(tmp_path)
    real_rename = Path.rename

    def rename(self: Path, target):
        if self.name.startswith(".thumbs-") and not self.name.startswith(".thumbs-old-"):
            raise OSError("interrupted installing the new set")
        return real_rename(self, target)

    monkeypatch.setattr(Path, "rename", rename)
    with pytest.raises(OSError):
        rec.record_thumbs(summary("a.jpg"), tmp_path, lambda rel: webp(1, 1))
    assert old.read_bytes() == b"old"
    assert [p.name for p in tmp_path.iterdir()] == ["thumbs"]


def test_failed_cleanup_keeps_the_new_thumbs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    old_bundle(tmp_path)
    real_rmtree = rec.shutil.rmtree

    def rmtree(path, ignore_errors=False, **kw):
        if Path(path).name.startswith(".thumbs-old-"):
            if not ignore_errors:
                raise OSError("a file held open")
            return None
        return real_rmtree(path, ignore_errors=ignore_errors, **kw)

    monkeypatch.setattr(rec.shutil, "rmtree", rmtree)
    rec.record_thumbs(summary("a.jpg"), tmp_path, lambda rel: webp(1, 1))
    assert sorted(p.name for p in (tmp_path / "thumbs").iterdir()) == ["a.webp"]
