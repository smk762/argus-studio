"use client";

import { useEffect, useState } from "react";
import { DropZone } from "@/components/DropZone";
import { uploadImages } from "@/lib/curatorApi";
import { immichPullStream, listImmichAlbums, type ImmichAlbum } from "@/lib/lensApi";
import { localSourcePath } from "@/lib/curatorEnv";
import { joinPath } from "@/lib/path";

/** Join a dataset-relative folder onto the curator container's source path. */
function absSourcePath(rel: string): string {
  const clean = rel.replace(/^\/+|\/+$/g, "");
  return localSourcePath() ? joinPath(localSourcePath(), clean) : clean;
}

const isImageFile = (f: File) => f.type.startsWith("image/");

/** Turn an album name into a safe dataset folder name. */
function slugify(name: string): string {
  return name.trim().replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "immich";
}

interface Props {
  /** Called with the folder (as the curator sees it) that just received images. */
  onIngested: (absFolder: string) => void;
  disabled?: boolean;
}

/**
 * Live-mode dataset ingestion: drag-and-drop images into the shared dataset
 * (curator POST /upload), or pull an Immich album via argus-lens
 * (POST /immich/pull). Either way the target folder is handed back so it can
 * be scanned immediately.
 */
export function IngestPanel({ onIngested, disabled = false }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [folder, setFolder] = useState("uploads");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [albums, setAlbums] = useState<ImmichAlbum[] | null>(null);
  const [immichOff, setImmichOff] = useState(false);
  const [albumId, setAlbumId] = useState("");
  const [pull, setPull] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listImmichAlbums()
      .then((a) => {
        if (cancelled) return;
        setAlbums(a);
        if (a.length > 0) setAlbumId((cur) => cur || a[0].id);
      })
      .catch(() => {
        if (!cancelled) setImmichOff(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runUpload = async () => {
    if (files.length === 0 || !folder.trim()) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await uploadImages(files, folder.trim());
      setNote(
        `Saved ${res.saved} image${res.saved === 1 ? "" : "s"} to ${res.folder || "the dataset root"}` +
          (res.skipped.length > 0 ? ` (${res.skipped.length} skipped)` : ""),
      );
      setFiles([]);
      if (res.saved > 0) onIngested(absSourcePath(res.folder));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const runPull = async () => {
    const album = albums?.find((a) => a.id === albumId);
    if (!album) return;
    setBusy(true);
    setError(null);
    setNote(null);
    setPull(null);
    try {
      const res = await immichPullStream(
        { album_id: album.id, dest_folder: `immich/${slugify(album.name)}` },
        (p) => setPull({ done: p.done, total: p.total }),
      );
      setNote(
        `Pulled ${res.downloaded} image${res.downloaded === 1 ? "" : "s"} from “${album.name}” into ${res.folder}` +
          (res.skipped > 0 ? ` (${res.skipped} already present)` : ""),
      );
      if (res.downloaded > 0 || res.skipped > 0) onIngested(absSourcePath(res.folder));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Immich pull failed");
    } finally {
      setBusy(false);
      setPull(null);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <span className="block text-xs font-semibold uppercase tracking-wider text-muted">Add images to dataset</span>

      <DropZone
        onFiles={(f) => setFiles((cur) => [...cur, ...f])}
        accept="image/*"
        filter={isImageFile}
        label="Drop images here"
        hint="Uploaded into the shared dataset, then scannable below"
      />
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="font-medium text-foreground/90">{files.length} staged</span>
          <span className="max-w-full truncate font-mono text-muted">{files.map((f) => f.name).join(", ")}</span>
          <button
            type="button"
            onClick={() => setFiles([])}
            className="cursor-pointer text-muted underline decoration-dotted hover:text-foreground"
          >
            clear
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          placeholder="uploads"
          title="Folder under the dataset root to save into"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-accent-teal/50 focus:outline-none focus:ring-2 focus:ring-accent-teal/50"
        />
        <button
          type="button"
          onClick={() => void runUpload()}
          disabled={disabled || busy || files.length === 0 || !folder.trim()}
          className="cursor-pointer whitespace-nowrap rounded-lg bg-accent-teal/20 px-3 py-2 text-xs font-semibold text-accent-teal transition-colors hover:bg-accent-teal/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && files.length > 0 ? "Uploading…" : "Upload"}
        </button>
      </div>

      {/* Immich pull */}
      {immichOff ? (
        <p className="text-[10px] leading-relaxed text-muted">
          Immich pull unavailable — set <span className="font-mono">IMMICH_URL</span> /{" "}
          <span className="font-mono">IMMICH_API_KEY</span> on argus-lens to enable it.
        </p>
      ) : albums === null ? (
        <p className="text-[10px] text-muted">Checking Immich…</p>
      ) : albums.length === 0 ? (
        <p className="text-[10px] text-muted">No Immich albums found.</p>
      ) : (
        <div className="flex gap-2">
          <select
            value={albumId}
            onChange={(e) => setAlbumId(e.target.value)}
            className="min-w-0 flex-1 cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-accent-teal/50 focus:outline-none focus:ring-2 focus:ring-accent-teal/50"
          >
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.asset_count})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void runPull()}
            disabled={disabled || busy || !albumId}
            className="cursor-pointer whitespace-nowrap rounded-lg bg-accent-teal/20 px-3 py-2 text-xs font-semibold text-accent-teal transition-colors hover:bg-accent-teal/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pull ? `${pull.done}/${pull.total}` : "Pull album"}
          </button>
        </div>
      )}

      {pull && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
          <div
            className="h-full rounded-full bg-accent-teal transition-all duration-300 ease-out"
            style={{ width: `${pull.total > 0 ? Math.round((pull.done / pull.total) * 100) : 0}%` }}
          />
        </div>
      )}
      {note && <p className="text-[11px] leading-relaxed text-accent-green">{note}</p>}
      {error && <p className="text-[11px] leading-relaxed text-accent-red">{error}</p>}
    </div>
  );
}
