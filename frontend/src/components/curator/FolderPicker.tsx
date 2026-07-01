"use client";

import { useCallback, useEffect, useState } from "react";
import { listFolders } from "@/lib/curatorApi";
import type { FolderListing } from "./types";

interface Props {
  /** Called with the absolute host path when a folder is chosen. */
  onSelect: (absPath: string) => void;
  selectedAbs?: string;
  /**
   * Folder-listing fetcher. Defaults to the curator's GET /folders; pass a
   * lens-backed fetcher (or any GET /folders peer) to reuse the picker.
   */
  fetcher?: (path: string, signal?: AbortSignal) => Promise<FolderListing>;
}

/** Browse Docker-mounted folders exposed by a peer's GET /folders endpoint. */
export function FolderPicker({ onSelect, selectedAbs, fetcher = listFolders }: Props) {
  const [rel, setRel] = useState("");
  const [listing, setListing] = useState<FolderListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch + apply results only in async callbacks (safe to call from an effect).
  const fetchListing = useCallback(
    (path: string, signal?: AbortSignal) => {
      fetcher(path, signal)
        .then((data) => {
          setListing(data);
          setRel(data.path);
          setError(null);
        })
        .catch((err) => {
          if (signal?.aborted) return;
          setError(err instanceof Error ? err.message : "Could not list folders");
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [fetcher],
  );

  // Navigation from user events may set the spinner synchronously.
  const load = useCallback(
    (path: string) => {
      setLoading(true);
      fetchListing(path);
    },
    [fetchListing],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchListing("", ctrl.signal);
    return () => ctrl.abort();
  }, [fetchListing]);

  const crumbs = rel ? rel.split("/") : [];

  if (error) {
    return (
      <div className="rounded-lg border border-accent-amber/30 bg-accent-amber/5 p-3 text-[11px] leading-relaxed text-accent-amber">
        Folder browsing unavailable: {error}. Configure a source root on the server, or enter a path manually below.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-2.5">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 text-[11px]">
        <button
          type="button"
          onClick={() => load("")}
          className="cursor-pointer rounded px-1.5 py-0.5 font-mono text-accent-teal hover:bg-surface-hover"
          title={listing?.root}
        >
          root
        </button>
        {crumbs.map((seg, i) => {
          const target = crumbs.slice(0, i + 1).join("/");
          return (
            <span key={target} className="flex items-center gap-1">
              <span className="text-muted">/</span>
              <button
                type="button"
                onClick={() => load(target)}
                className="cursor-pointer rounded px-1 py-0.5 font-mono text-foreground/90 hover:bg-surface-hover"
              >
                {seg}
              </button>
            </span>
          );
        })}
      </div>

      {/* Listing */}
      <div className="scrollbar-thin max-h-52 space-y-1 overflow-y-auto">
        {loading && <div className="px-1 py-2 text-[11px] text-muted">Loading…</div>}
        {!loading && listing && listing.parent !== null && (
          <button
            type="button"
            onClick={() => load(listing.parent ?? "")}
            className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted hover:bg-surface-hover"
          >
            <span className="font-mono">../</span> up one level
          </button>
        )}
        {!loading &&
          listing?.folders.map((f) => {
            const isSel = selectedAbs === f.abs_path;
            return (
              <div
                key={f.rel_path}
                className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 ${
                  isSel ? "bg-accent-teal/10" : "hover:bg-surface-hover"
                }`}
              >
                <button
                  type="button"
                  onClick={() => (f.subfolder_count > 0 ? load(f.rel_path) : onSelect(f.abs_path))}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                  title={f.abs_path}
                >
                  <span className="text-accent-amber">{f.subfolder_count > 0 ? "▸" : "•"}</span>
                  <span className="truncate text-xs text-foreground">{f.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted">
                    {f.image_count} img{f.subfolder_count > 0 ? ` · ${f.subfolder_count} sub` : ""}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(f.abs_path)}
                  className={`shrink-0 cursor-pointer rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    isSel
                      ? "bg-accent-teal/20 text-accent-teal"
                      : "border border-border text-muted hover:text-foreground"
                  }`}
                >
                  {isSel ? "selected" : "use"}
                </button>
              </div>
            );
          })}
        {!loading && listing && listing.folders.length === 0 && (
          <div className="px-2 py-2 text-[11px] text-muted">
            No sub-folders here.{" "}
            {listing.direct_image_count > 0 && `${listing.direct_image_count} images directly in this folder.`}
          </div>
        )}
      </div>

      {/* Use current folder */}
      {listing && (
        <button
          type="button"
          onClick={() => onSelect(listing.abs_path)}
          className={`w-full cursor-pointer rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            selectedAbs === listing.abs_path
              ? "bg-accent-teal/20 text-accent-teal"
              : "border border-border text-muted hover:text-foreground"
          }`}
        >
          Use this folder{listing.direct_image_count > 0 ? ` (${listing.direct_image_count} direct images)` : ""}
        </button>
      )}
    </div>
  );
}
