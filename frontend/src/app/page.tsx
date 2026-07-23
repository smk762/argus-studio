"use client";

import { useEffect, useRef, useState } from "react";
import type { BatchCaptionResult, CaptionResult, CaptionRequest } from "@/types";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ApiVersionBadge } from "@/components/ApiVersionBadge";
import { TARGET_BACKENDS, TARGET_STYLES, TARGET_CATEGORIES } from "@/types";
import { ImagePreview } from "@/components/ImagePreview";
import { CaptionVariants } from "@/components/CaptionVariants";
import { RawOutputs } from "@/components/RawOutputs";
import { AutoRemoved } from "@/components/AutoRemoved";
import { ExportButtons } from "@/components/ExportButtons";
import { ParamInfo } from "@/components/ParamInfo";
import { BatchCaptionResults } from "@/components/BatchCaptionResults";
import { FolderPicker } from "@/components/curator/FolderPicker";
import { DropZone } from "@/components/DropZone";
import { StageHandoff } from "@/components/StageHandoff";
import { useDeepLink } from "@/lib/deepLink";
import {
  HybridBalance,
  hybridRequestFields,
  FALLBACK_HYBRID_PRESETS,
  FALLBACK_DEFAULT_PRESET,
  type HybridBalanceValue,
} from "@/components/HybridBalance";
import {
  captionFilesStream,
  captionFolder,
  captionManifestStream,
  getLensProfiles,
  immichCaptionStream,
  listImmichAlbums,
  listLensFolders,
  type ImmichAlbum,
} from "@/lib/lensApi";
import { lensUrl } from "@/lib/curatorEnv";

type InputMode = "url" | "upload" | "folder" | "immich" | "manifest";

const MODE_LABELS: Record<InputMode, string> = {
  url: "Single URL",
  upload: "Upload",
  folder: "Local folder",
  immich: "Immich",
  manifest: "Curate manifest",
};

const isImageFile = (f: File) => f.type.startsWith("image/");
const isManifestFile = (f: File) => /\.jsonl?$/i.test(f.name);

export default function Home() {
  const [mode, setMode] = useState<InputMode>("url");
  const [imageUrl, setImageUrl] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [recursive, setRecursive] = useState(false);
  const [writeSidecar, setWriteSidecar] = useState(true);
  const [writeXmp, setWriteXmp] = useState(false);
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [immichAlbums, setImmichAlbums] = useState<ImmichAlbum[] | null>(null);
  const [immichError, setImmichError] = useState<string | null>(null);
  const [albumId, setAlbumId] = useState("");
  const [writeBack, setWriteBack] = useState(true);
  const [targetBackend, setTargetBackend] = useState("sdxl");
  const [targetStyle, setTargetStyle] = useState("photo");
  const [targetCategory, setTargetCategory] = useState("identity");
  const [proseEnrichment, setProseEnrichment] = useState(true);
  const [hybridPresets, setHybridPresets] = useState<Record<string, number>>(FALLBACK_HYBRID_PRESETS);
  const [hybrid, setHybrid] = useState<HybridBalanceValue>({
    preset: FALLBACK_DEFAULT_PRESET,
    proseBias: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CaptionResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchCaptionResult | null>(null);
  const [batchSource, setBatchSource] = useState("");
  // The host folder the last batch wrote .txt sidecars into, or null when the
  // last batch has nothing forge could read (a manifest/upload/Immich run, or a
  // folder run with sidecars off). Drives the hand-off to /forge (#67); kept
  // separate from `batchSource`, which is a human label and set by every mode.
  const [captionedFolder, setCaptionedFolder] = useState<string | null>(null);
  const [analyzedUrl, setAnalyzedUrl] = useState("");
  // Remembers the last single-image caption so it can be re-run with a new balance.
  const [lastSingle, setLastSingle] = useState<
    { kind: "url"; url: string } | { kind: "upload"; file: File } | null
  >(null);
  const [lensVersion, setLensVersion] = useState<string | null>(null);
  // The live blob URL for an uploaded preview (revoked before it's replaced).
  const objectUrlRef = useRef<string | null>(null);
  // True once the user picks a preset/slider, so a late /profiles response
  // doesn't reset their choice to the server default.
  const hybridTouched = useRef(false);
  const onHybridChange = (value: HybridBalanceValue) => {
    hybridTouched.current = true;
    setHybrid(value);
  };

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  // Deep link from a finished curator export that was not captioned (#67):
  // /?folder=<dir>&category=<target_category>. Only prefills — nothing runs
  // until the visitor presses Caption folder, since a batch write into someone
  // else's export should not be one click away from a pasted URL.
  useDeepLink((params) => {
    const folder = params.get("folder");
    if (!folder) return;
    setFolderPath(folder);
    setMode("folder");
    // The curator hands off a lens-valid value (its LENS_CATEGORY map bridges
    // the two taxonomies); still validate, because a hand-edited URL could carry
    // anything and the value is echoed straight into the caption request.
    const category = params.get("category");
    if (category && TARGET_CATEGORIES.some((c) => c.value === category)) setTargetCategory(category);
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Version from /health (newer lens), backend readiness from /backends;
        // tolerate either being missing so older servers still show status.
        const [healthResp, backendsResp] = await Promise.allSettled([
          fetch(`${lensUrl()}/health`),
          fetch(`${lensUrl()}/backends`),
        ]);
        let version = "";
        if (healthResp.status === "fulfilled" && healthResp.value.ok) {
          const h: { version?: string } = await healthResp.value.json();
          if (h.version) version = `v${h.version}`;
        }
        let backendsLabel = "";
        if (backendsResp.status === "fulfilled" && backendsResp.value.ok) {
          const data: { backends?: Record<string, { available?: boolean }> } = await backendsResp.value.json();
          const backends = Object.values(data.backends ?? {});
          const available = backends.filter((b) => b?.available).length;
          backendsLabel = backends.length > 0 ? `${available}/${backends.length} backends` : "connected";
        }
        // Empty string = unreachable (renders the red banner).
        if (!cancelled) setLensVersion([version, backendsLabel].filter(Boolean).join(" · "));
      } catch {
        if (!cancelled) setLensVersion("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch the hybrid tag↔prose presets; fall back to the hardcoded set on failure.
  useEffect(() => {
    let cancelled = false;
    getLensProfiles()
      .then((profiles) => {
        if (cancelled) return;
        const presets = profiles.hybrid_presets;
        if (presets && Object.keys(presets).length > 0) {
          setHybridPresets(presets);
          const def = profiles.default_hybrid_preset;
          // Don't clobber a selection the user already made while this was loading.
          if (def && def in presets && !hybridTouched.current) setHybrid({ preset: def, proseBias: null });
        }
      })
      .catch(() => {
        /* keep the hardcoded fallback presets */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runUrl = async (url: string) => {
    if (!url) return;
    setLoading(true);
    setError(null);

    try {
      const body: CaptionRequest = {
        image_url: url,
        target_style: targetStyle,
        target_category: targetCategory,
        target_backend: targetBackend,
        prose_enrichment: proseEnrichment,
        ...hybridRequestFields(hybrid),
      };

      const resp = await fetch(`${lensUrl()}/caption/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const detail = await resp.json().catch(() => null);
        throw new Error(
          detail?.detail ?? `Server error: ${resp.status}`
        );
      }

      const data: CaptionResult = await resp.json();
      setResult(data);
      setAnalyzedUrl(url);
      setLastSingle({ kind: "url", url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    void runUrl(imageUrl.trim());
  };

  const runFolder = async () => {
    // Snapshot the path for this run: the input stays editable while captioning
    // streams, so reading state again after the await could label the results
    // (and the /forge hand-off) with a folder the user has since typed over.
    const folder = folderPath.trim();
    if (!folder) return;
    setLoading(true);
    setError(null);
    setBatchResult(null);
    setCaptionedFolder(null);
    try {
      const data = await captionFolder({
        folder,
        recursive,
        write_sidecar: writeSidecar,
        write_xmp: writeXmp,
        target_style: targetStyle,
        target_category: targetCategory,
        target_backend: targetBackend,
        prose_enrichment: proseEnrichment,
        ...hybridRequestFields(hybrid),
      });
      setBatchResult(data);
      setBatchSource(folder);
      // Sidecars are what forge sizes a dataset from: without them the folder
      // has images and no captions, and the next stage has nothing to read.
      if (writeSidecar && data.captioned > 0) setCaptionedFolder(folder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const runManifest = async () => {
    if (!manifestFile) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setBatchResult(null);
    setCaptionedFolder(null);
    setBatchSource(manifestFile.name);

    const rows: { rel_path: string; final_caption: string }[] = [];
    const errors: { rel_path: string; error: string }[] = [];
    try {
      const manifestText = await manifestFile.text();
      // Seed a total from the manifest line count so the bar renders before the
      // first row lands; the server's authoritative total overrides it below.
      const total = manifestText.split("\n").filter((l) => l.trim()).length;
      setProgress({ done: 0, total });

      const summary = await captionManifestStream(
        manifestText,
        (p) => {
          setProgress({ done: p.done, total: p.total });
          if (p.error) errors.push({ rel_path: p.rel_path, error: p.error });
          else rows.push({ rel_path: p.rel_path, final_caption: p.final_caption ?? "" });
          // Publish a growing snapshot so captions stream into the results table.
          setBatchResult({
            total: p.total,
            captioned: rows.length,
            failed: errors.length,
            results: [...rows],
            errors: [...errors],
          });
        },
        { write_sidecar: writeSidecar, write_xmp: writeXmp },
      );
      setBatchResult({ ...summary, results: rows, errors });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const runUpload = async (files: File[] = uploadFiles) => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setBatchResult(null);
    setCaptionedFolder(null);
    setProgress({ done: 0, total: files.length });
    try {
      const rows = await captionFilesStream(
        files,
        {
          target_style: targetStyle,
          target_category: targetCategory,
          target_backend: targetBackend,
          ...hybridRequestFields(hybrid),
        },
        (_row, done) => setProgress({ done, total: files.length }),
      );
      if (rows.length === 1 && files.length === 1) {
        // Single upload: show the full variant/raw-output breakdown like URL mode.
        setResult(rows[0]);
        // Revoke the previous blob URL before minting a new one — re-captioning
        // the same upload would otherwise leak one per run.
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = URL.createObjectURL(files[0]);
        setAnalyzedUrl(objectUrlRef.current);
        setLastSingle({ kind: "upload", file: files[0] });
      } else {
        const skipped = files.length - rows.length;
        setBatchResult({
          total: files.length,
          captioned: rows.length,
          failed: skipped,
          results: rows.map((r) => ({ rel_path: r.name, final_caption: r.final_caption })),
          errors:
            skipped > 0
              ? [{ rel_path: "(skipped)", error: `${skipped} file(s) could not be decoded as images` }]
              : [],
        });
        setBatchSource(`${files.length} uploaded file(s)`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const runImmich = async () => {
    if (!albumId) return;
    const album = immichAlbums?.find((a) => a.id === albumId);
    setLoading(true);
    setError(null);
    setBatchResult(null);
    setCaptionedFolder(null);
    setProgress(null);
    const rows: { rel_path: string; final_caption: string }[] = [];
    const errors: { rel_path: string; error: string }[] = [];
    try {
      const summary = await immichCaptionStream(
        {
          album_id: albumId,
          target_style: targetStyle,
          target_category: targetCategory,
          target_backend: targetBackend,
          prose_enrichment: proseEnrichment,
          write_back: writeBack,
          ...hybridRequestFields(hybrid),
        },
        (p) => {
          setProgress({ done: p.done, total: p.total });
          if (p.error) errors.push({ rel_path: p.name, error: p.error });
          else rows.push({ rel_path: p.name, final_caption: p.final_caption ?? "" });
        },
      );
      setBatchResult({ ...summary, results: rows, errors });
      setBatchSource(album ? `Immich · ${album.name}` : "Immich album");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  /** Re-run the last single-image caption with the current tag↔prose balance. */
  const recaptionLast = () => {
    if (!lastSingle || loading) return;
    if (lastSingle.kind === "url") void runUrl(lastSingle.url);
    else void runUpload([lastSingle.file]);
  };

  // Load the album list when the Immich tab is first opened.
  useEffect(() => {
    if (mode !== "immich" || immichAlbums !== null) return;
    let cancelled = false;
    setImmichError(null);
    listImmichAlbums()
      .then((albums) => {
        if (cancelled) return;
        setImmichAlbums(albums);
        if (albums.length > 0) setAlbumId((cur) => cur || albums[0].id);
      })
      .catch((err) => {
        if (!cancelled) setImmichError(err instanceof Error ? err.message : "Failed to reach Immich");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, immichAlbums]);

  /** Route files dropped anywhere on the page: manifests to the manifest tab, images to Upload. */
  const handlePageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    const manifest = files.find(isManifestFile);
    if (manifest) {
      setManifestFile(manifest);
      setMode("manifest");
      return;
    }
    const images = files.filter(isImageFile);
    if (images.length > 0) {
      setUploadFiles((cur) => [...cur, ...images]);
      setMode("upload");
    }
  };

  return (
    <div
      className="flex flex-col min-h-screen"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handlePageDrop}
    >
      <SiteHeader
        active="/"
        logo={{ letter: "A" }}
        title="Argus Lens"
        subtitle="Structured image captioning for training & generation"
        badge={<ApiVersionBadge label="argus-lens" version={lensVersion} />}
      />

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Input form */}
        <div className="mb-8">
          {/* Input mode switcher */}
          <div className="mb-4 inline-flex rounded-lg border border-border bg-surface p-1">
            {(["url", "upload", "folder", "immich", "manifest"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  // The /forge hand-off belongs to the folder batch that set it;
                  // drop it when the user moves to a different input mode so it
                  // can't point at a folder no longer on screen.
                  setCaptionedFolder(null);
                }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  mode === m ? "bg-accent-purple text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          {/* URL mode */}
          {mode === "url" && (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-6">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Paste image URL (https://...)"
                required
                className="flex-1 px-4 py-3 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple/50 focus:border-accent-purple/50 text-sm"
              />
              <button
                type="submit"
                disabled={loading || !imageUrl.trim()}
                className="px-6 py-3 rounded-lg bg-accent-purple text-white font-medium text-sm hover:bg-accent-purple/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
              >
                {loading ? <Spinner label="Analyzing..." /> : "Analyze"}
              </button>
            </form>
          )}

          {/* Upload mode */}
          {mode === "upload" && (
            <div className="mb-6 space-y-3">
              <DropZone
                onFiles={(files) => setUploadFiles((cur) => [...cur, ...files])}
                accept="image/*"
                filter={isImageFile}
                label="Drop images here, or click to browse"
                hint="A single image shows the full breakdown; multiple images run as a batch."
              />
              {uploadFiles.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-foreground/90">
                    {uploadFiles.length} file{uploadFiles.length > 1 ? "s" : ""}
                  </span>
                  <span className="max-w-md truncate font-mono text-muted">
                    {uploadFiles.map((f) => f.name).join(", ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setUploadFiles([])}
                    className="cursor-pointer text-muted underline decoration-dotted hover:text-foreground"
                  >
                    clear
                  </button>
                </div>
              )}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => void runUpload()}
                  disabled={loading || uploadFiles.length === 0}
                  className="px-6 py-3 rounded-lg bg-accent-purple text-white font-medium text-sm hover:bg-accent-purple/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                >
                  {loading ? (
                    <Spinner label="Captioning..." />
                  ) : (
                    `Caption ${uploadFiles.length || ""} image${uploadFiles.length === 1 ? "" : "s"}`
                  )}
                </button>
                {progress && <ProgressLine done={progress.done} total={progress.total} />}
              </div>
            </div>
          )}

          {/* Immich mode */}
          {mode === "immich" && (
            <div className="mb-6 space-y-3">
              <p className="text-xs text-muted">
                Caption an <a className="text-accent-purple hover:text-accent-purple/80" href="https://immich.app" target="_blank" rel="noopener noreferrer">Immich</a>{" "}
                album straight from your photo server — nothing is copied into the dataset. With write-back enabled,
                each caption is pushed to the asset&apos;s description in Immich.
              </p>
              {immichError ? (
                <div className="rounded-lg border border-accent-red/30 bg-accent-red/5 p-3 text-xs text-accent-red">
                  {immichError}
                  <span className="block mt-1 text-muted">
                    Set <span className="font-mono">IMMICH_URL</span> and{" "}
                    <span className="font-mono">IMMICH_API_KEY</span> on the argus-lens server to enable this mode.
                  </span>
                </div>
              ) : immichAlbums === null ? (
                <p className="text-xs text-muted">Loading albums…</p>
              ) : immichAlbums.length === 0 ? (
                <p className="text-xs text-muted">No albums found on the Immich server.</p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={albumId}
                    onChange={(e) => setAlbumId(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple/50 cursor-pointer"
                  >
                    {immichAlbums.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.asset_count} assets)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void runImmich()}
                    disabled={loading || !albumId}
                    className="px-6 py-3 rounded-lg bg-accent-purple text-white font-medium text-sm hover:bg-accent-purple/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {loading ? <Spinner label="Captioning..." /> : "Caption album"}
                  </button>
                </div>
              )}
              <div className="flex items-center gap-4">
                <Toggle checked={writeBack} onChange={setWriteBack} label="Write captions back to Immich" />
                {progress && <ProgressLine done={progress.done} total={progress.total} />}
              </div>
            </div>
          )}

          {/* Local folder mode */}
          {mode === "folder" && (
            <div className="mb-6 space-y-3">
              <p className="text-xs text-muted">
                Caption every image in a folder on the argus-lens host (e.g. a shared Docker volume). Writes{" "}
                <span className="font-mono text-foreground/80">.txt</span> sidecars next to each image.
              </p>
              <FolderPicker fetcher={listLensFolders} onSelect={setFolderPath} selectedAbs={folderPath} />
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="/data/images"
                  className="flex-1 px-4 py-3 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple/50 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void runFolder()}
                  disabled={loading || !folderPath.trim()}
                  className="px-6 py-3 rounded-lg bg-accent-purple text-white font-medium text-sm hover:bg-accent-purple/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                >
                  {loading ? <Spinner label="Captioning..." /> : "Caption folder"}
                </button>
              </div>
              <div className="flex flex-wrap gap-5">
                <Toggle checked={recursive} onChange={setRecursive} label="Recursive" />
                <Toggle checked={writeSidecar} onChange={setWriteSidecar} label="Write .txt sidecars" />
                <Toggle checked={writeXmp} onChange={setWriteXmp} label="Write .xmp sidecars" />
              </div>
            </div>
          )}

          {/* Curate manifest mode */}
          {mode === "manifest" && (
            <div className="mb-6 space-y-3">
              <p className="text-xs text-muted">
                Upload a <span className="font-mono text-foreground/80">manifest.jsonl</span> from the Curate step. Each
                row&apos;s <span className="font-mono text-foreground/80">target_profile</span> is applied per image, so
                the parameters below are ignored.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="file"
                  accept=".jsonl,.json,application/x-ndjson"
                  onChange={(e) => setManifestFile(e.target.files?.[0] ?? null)}
                  className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-accent-purple/20 file:px-3 file:py-1.5 file:text-accent-purple"
                />
                <button
                  type="button"
                  onClick={() => void runManifest()}
                  disabled={loading || !manifestFile}
                  className="px-6 py-3 rounded-lg bg-accent-purple text-white font-medium text-sm hover:bg-accent-purple/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                >
                  {loading ? <Spinner label="Captioning..." /> : "Caption manifest"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-5">
                <Toggle checked={writeSidecar} onChange={setWriteSidecar} label="Write .txt sidecars" />
                <Toggle checked={writeXmp} onChange={setWriteXmp} label="Write .xmp sidecars" />
                {progress && <ProgressLine done={progress.done} total={progress.total} />}
              </div>
            </div>
          )}

          {/* Parameters — ignored in manifest mode (profiles come from the manifest) */}
          {mode !== "manifest" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Target Style */}
            <ParamInfo conceptId="target_style">
              <div className="flex gap-2">
                {TARGET_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setTargetStyle(style)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      targetStyle === style
                        ? "bg-accent-purple text-white"
                        : "bg-surface border border-border text-foreground hover:bg-surface-hover"
                    }`}
                  >
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </button>
                ))}
              </div>
            </ParamInfo>

            {/* Target Backend */}
            <ParamInfo conceptId="target_backend">
              <select
                value={targetBackend}
                onChange={(e) => setTargetBackend(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple/50 cursor-pointer"
              >
                {TARGET_BACKENDS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label} ({b.tokens} tokens)
                  </option>
                ))}
              </select>
            </ParamInfo>

            {/* Target Category */}
            <ParamInfo conceptId="target_category">
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple/50 cursor-pointer"
              >
                {TARGET_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </ParamInfo>

            {/* Prose Enrichment — not accepted by the upload endpoint (/caption/stream) */}
            {mode !== "upload" && (
            <ParamInfo conceptId="prose_enrichment">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setProseEnrichment(!proseEnrichment)}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors cursor-pointer ${
                    proseEnrichment ? "bg-accent-purple" : "bg-border"
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      proseEnrichment ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-foreground/80">
                  {proseEnrichment ? "Enabled" : "Disabled"}
                </span>
              </div>
            </ParamInfo>
            )}
          </div>
          )}

          {/* Tag ↔ prose balance — applies to every mode except manifest (row-driven) */}
          {mode !== "manifest" && (
            <div className="mt-4">
              <HybridBalance presets={hybridPresets} value={hybrid} onChange={onHybridChange} />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-lg border border-accent-red/30 bg-accent-red/5 text-accent-red text-sm">
            {error}
          </div>
        )}

        {/* Batch results (folder / manifest) */}
        {mode !== "url" && batchResult && (
          <BatchCaptionResults result={batchResult} source={batchSource} />
        )}

        {/* Next stage: a captioned folder on the lens host is exactly what forge
            wants. No trigger word rides along — this page does not write one
            into the captions, so forge's own slug of the folder name is as good
            a guess as any, and its placeholder shows what that will be. */}
        {captionedFolder && (
          <div className="mt-4">
            <StageHandoff href={`/forge?export=${encodeURIComponent(captionedFolder)}`} />
          </div>
        )}

        {/* Single-image result (URL mode, or a one-file upload) */}
        {(mode === "url" || mode === "upload") && result && (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
            {/* Left: image */}
            <div className="space-y-4">
              <ImagePreview url={analyzedUrl} />
              <div className="text-xs text-muted truncate px-1">
                {analyzedUrl}
              </div>
              <div className="px-1 flex items-center gap-2">
                <span className="text-xs text-muted">Backend:</span>
                <span className="text-xs text-accent-purple font-medium">
                  {result.backend_name}
                </span>
              </div>
              <ExportButtons result={result} imageUrl={analyzedUrl} />
              {lastSingle && (
                <button
                  type="button"
                  onClick={recaptionLast}
                  disabled={loading}
                  className="w-full px-4 py-2.5 rounded-lg border border-accent-purple/40 bg-accent-purple/10 text-accent-purple text-sm font-medium hover:bg-accent-purple/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {loading ? (
                    <Spinner label="Re-captioning..." />
                  ) : (
                    <>
                      Re-caption with this balance
                      <span className="ml-1.5 font-mono text-xs text-accent-purple/70">
                        {hybrid.proseBias != null
                          ? `prose_bias ${hybrid.proseBias.toFixed(2)}`
                          : hybrid.preset}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Right: caption data */}
            <div className="space-y-6 scrollbar-thin">
              <CaptionVariants result={result} />
              <RawOutputs result={result} />
              <AutoRemoved result={result} />
            </div>
          </div>
        )}

        {/* Empty state */}
        {(mode === "url" || mode === "upload" ? !result && !batchResult : !batchResult) && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-foreground/60 mb-1">
              {mode === "url"
                ? "Paste an image URL to get started"
                : mode === "upload"
                  ? "Drop images anywhere on this page"
                  : mode === "folder"
                    ? "Pick a folder to batch-caption"
                    : mode === "immich"
                      ? "Pick an Immich album to batch-caption"
                      : "Upload a curate manifest to batch-caption"}
            </h2>
            <p className="text-sm text-muted max-w-md">
              {mode === "url"
                ? "Argus Lens will generate structured caption variants optimised for LoRA training, with raw model outputs and auto-removed tag analysis."
                : "Argus Lens writes a .txt sidecar next to each image using the LoRA-optimised final caption — ready to drop straight into training."}
            </p>

            {/* Quick reference */}
            <div className="mt-12 w-full max-w-2xl text-left">
              <h3 className="text-xs font-semibold tracking-widest text-muted uppercase mb-4 text-center">
                Pipeline Overview
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PipelineStep
                  number={1}
                  title="Multi-model inference"
                  description="WD14 produces booru tags; Florence-2 / BLIP-2 generate natural language prose. Both run in parallel via the hybrid pipeline."
                />
                <PipelineStep
                  number={2}
                  title="Fragment classification"
                  description="Each tag or phrase is classified into: identity, wardrobe, camera/framing, pose/gaze, setting, lighting, action. Camera framing is hard-protected (never dropped); pose/gaze is soft-protected."
                />
                <PipelineStep
                  number={3}
                  title="Redundancy filtering"
                  description="Prose clauses whose content words overlap with existing tags are removed. Novel clauses are kept for enrichment."
                />
                <PipelineStep
                  number={4}
                  title="Token-budget assembly"
                  description="Fragments are assembled into caption variants per category, respecting the target backend's CLIP/T5 token limit."
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <SiteFooter
        poweredBy={
          <a
            href="https://github.com/smk762/argus-lens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-purple hover:text-accent-purple/80 transition-colors"
          >
            argus-lens
          </a>
        }
        right="MIT License"
      />
    </div>
  );
}

function ProgressLine({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex min-w-40 flex-1 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
        <div
          className="h-full rounded-full bg-accent-purple transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-xs tabular-nums text-accent-purple">
        {done} / {total}
      </span>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {label}
    </span>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/80">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-accent-purple" : "bg-border"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-1"
          }`}
        />
      </button>
      {label}
    </label>
  );
}

function PipelineStep({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-full bg-accent-purple/20 border border-accent-purple/40 flex items-center justify-center text-xs font-bold text-accent-purple">
          {number}
        </span>
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>
      <p className="text-xs text-muted leading-relaxed">{description}</p>
    </div>
  );
}
