"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BatchCaptionResult, CaptionResult, CaptionRequest } from "@/types";
import { TARGET_BACKENDS, TARGET_STYLES, TARGET_CATEGORIES } from "@/types";
import { ImagePreview } from "@/components/ImagePreview";
import { CaptionVariants } from "@/components/CaptionVariants";
import { RawOutputs } from "@/components/RawOutputs";
import { AutoRemoved } from "@/components/AutoRemoved";
import { ExportButtons } from "@/components/ExportButtons";
import { ParamInfo } from "@/components/ParamInfo";
import { BatchCaptionResults } from "@/components/BatchCaptionResults";
import { FolderPicker } from "@/components/curator/FolderPicker";
import { captionFolder, captionManifest, listLensFolders } from "@/lib/lensApi";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

type InputMode = "url" | "folder" | "manifest";

export default function Home() {
  const [mode, setMode] = useState<InputMode>("url");
  const [imageUrl, setImageUrl] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [recursive, setRecursive] = useState(false);
  const [writeSidecar, setWriteSidecar] = useState(true);
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [targetBackend, setTargetBackend] = useState("sdxl");
  const [targetStyle, setTargetStyle] = useState("photo");
  const [targetCategory, setTargetCategory] = useState("identity");
  const [proseEnrichment, setProseEnrichment] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CaptionResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchCaptionResult | null>(null);
  const [batchSource, setBatchSource] = useState("");
  const [analyzedUrl, setAnalyzedUrl] = useState("");
  const [lensVersion, setLensVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The lens API has no /version route; /backends is its status endpoint.
        // A 200 here means the API is reachable — report how many backends are ready.
        const resp = await fetch(`${API_URL}/backends`);
        if (!resp.ok) throw new Error(String(resp.status));
        const data: { backends?: Record<string, { available?: boolean }> } = await resp.json();
        const backends = Object.values(data.backends ?? {});
        const available = backends.filter((b) => b?.available).length;
        if (!cancelled) setLensVersion(backends.length > 0 ? `${available}/${backends.length} backends` : "connected");
      } catch {
        if (!cancelled) setLensVersion("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedBackend = TARGET_BACKENDS.find(
    (b) => b.value === targetBackend
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const body: CaptionRequest = {
        image_url: imageUrl.trim(),
        target_style: targetStyle,
        target_category: targetCategory,
        target_backend: targetBackend,
        prose_enrichment: proseEnrichment,
      };

      const resp = await fetch(`${API_URL}/caption/url`, {
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
      setAnalyzedUrl(imageUrl.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const runFolder = async () => {
    if (!folderPath.trim()) return;
    setLoading(true);
    setError(null);
    setBatchResult(null);
    try {
      const data = await captionFolder({
        folder: folderPath.trim(),
        recursive,
        write_sidecar: writeSidecar,
        target_style: targetStyle,
        target_category: targetCategory,
        target_backend: targetBackend,
        prose_enrichment: proseEnrichment,
      });
      setBatchResult(data);
      setBatchSource(folderPath.trim());
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
    setBatchResult(null);
    try {
      const data = await captionManifest(manifestFile, { write_sidecar: writeSidecar });
      setBatchResult(data);
      setBatchSource(manifestFile.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {/* Nav links */}
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-lg text-sm text-foreground bg-surface-hover border border-border"
              >
                Caption
              </Link>
              <Link
                href="/curate"
                className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                Curate
              </Link>
            </nav>

            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 shrink-0 rounded-lg bg-accent-purple/20 border border-accent-purple/40 flex items-center justify-center">
                <span className="text-accent-purple text-sm font-bold">A</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-foreground">
                  Argus Lens
                </h1>
                <p className="text-xs text-muted">
                  Structured image captioning for training &amp; generation
                </p>
              </div>
            </div>
          </div>
          <div
            className="shrink-0 text-right max-w-[14rem] sm:max-w-xs"
            title={
              lensVersion && lensVersion.length > 0
                ? `argus-lens ${lensVersion}`
                : undefined
            }
          >
            {lensVersion === null ? (
              <span className="text-[10px] uppercase tracking-wider text-muted/60">
                …
              </span>
            ) : lensVersion === "" ? (
              <span className="text-[10px] uppercase tracking-wider text-accent-red/80">
                API unreachable
              </span>
            ) : (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] uppercase tracking-wider text-muted">
                  argus-lens
                </span>
                <span className="text-xs font-mono text-foreground/90 truncate max-w-full">
                  {lensVersion}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Input form */}
        <div className="mb-8">
          {/* Input mode switcher */}
          <div className="mb-4 inline-flex rounded-lg border border-border bg-surface p-1">
            {(["url", "folder", "manifest"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  mode === m ? "bg-accent-purple text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {m === "url" ? "Single URL" : m === "folder" ? "Local folder" : "Curate manifest"}
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
              <Toggle checked={writeSidecar} onChange={setWriteSidecar} label="Write .txt sidecars" />
            </div>
          )}

          {/* Parameters — ignored in manifest mode (profiles come from the manifest) */}
          {mode !== "manifest" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Target Style */}
            <ParamInfo
              label="Target Style"
              description='Determines how tags are classified and budgeted. "photo" optimises for realism models (natural language tokens). "anime" optimises for booru-tagged models (tag-style tokens, higher density).'
              example='target_style="photo"'
            >
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
            <ParamInfo
              label="Target Backend"
              description={`The diffusion model architecture that will consume these captions. Each backend has a different CLIP/T5 token budget — exceeding it means wasted tokens the model cannot see. Current: ${selectedBackend?.tokens ?? 60} tokens.`}
              example='target_backend="sdxl"'
            >
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
            <ParamInfo
              label="Target Category"
              description='Controls which caption variant becomes the "final_caption" in the output. For identity-focused LoRA training, keep this as "identity". Change to "wardrobe" or "setting" if fine-tuning for those concepts instead.'
              example='target_category="identity"'
            >
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

            {/* Prose Enrichment */}
            <ParamInfo
              label="Prose Enrichment"
              description="When enabled, novel noun/adjective phrases from prose output (Florence-2) are extracted and appended to the training variant as low-priority tag-style tokens. This adds scene context without displacing core identity or wardrobe tags. Disable for a pure WD14-only training caption."
              example="prose_enrichment=true"
            >
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

        {/* Single-URL result */}
        {mode === "url" && result && (
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
        {(mode === "url" ? !result : !batchResult) && !loading && !error && (
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
                : mode === "folder"
                  ? "Pick a folder to batch-caption"
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
      <footer className="border-t border-border py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-muted">
          <span>
            Powered by{" "}
            <a
              href="https://github.com/smk762/argus-lens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-purple hover:text-accent-purple/80 transition-colors"
            >
              argus-lens
            </a>
          </span>
          <span>MIT License</span>
        </div>
      </footer>
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
