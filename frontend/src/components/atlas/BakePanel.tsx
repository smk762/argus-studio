"use client";

import { useEffect, useRef, useState } from "react";
import { bakeStream, type AtlasPreset, type BakeProgress } from "@/lib/atlasApi";
import { permits, type Capability } from "@/lib/capabilities";
import { CapabilityNotice } from "@/components/CapabilityNotice";
import { Field, inputClass } from "@/components/atlas/NewCanvas";

/**
 * Bake one job through the host's diffusion backend (`POST /bake/stream`),
 * streaming atlas's `controls → generate → georeference → done | error` frames.
 *
 * The preset menu is the demo-friendly path: a preset fills prompt, negative,
 * denoise, cfg and steps on the server, so the form only needs a checkpoint.
 * The form stays visible on a read-only host (argus-studio#66) with the reason
 * it is inert, rather than disappearing.
 */
export function BakePanel({
  jobId,
  presets,
  canBake,
  onBaked,
}: {
  jobId: string;
  presets: AtlasPreset[];
  canBake: Capability;
  onBaked: () => void;
}) {
  const [preset, setPreset] = useState("antique");
  const [checkpoint, setCheckpoint] = useState("");
  const [lora, setLora] = useState("");
  const [loraWeight, setLoraWeight] = useState("0.8");
  const [seed, setSeed] = useState("");
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [frames, setFrames] = useState<BakeProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  // The stream outlives the panel when the visitor picks another job mid-bake.
  const ctrlRef = useRef<AbortController | null>(null);
  useEffect(() => () => ctrlRef.current?.abort(), []);

  const chosen = presets.find((p) => p.name === preset);
  const num = (v: string) => (v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);

  const start = async () => {
    setRunning(true);
    setError(null);
    setFrames([]);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      await bakeStream(
        {
          job_id: jobId,
          checkpoint: checkpoint.trim(),
          lora: lora.trim() || undefined,
          lora_weight: lora.trim() ? num(loraWeight) : undefined,
          preset: preset || undefined,
          prompt: prompt.trim() || undefined,
          seed: num(seed),
        },
        (frame) => setFrames((f) => [...f, frame]),
        ctrl.signal,
      );
      onBaked();
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Bake failed");
      // A failed alignment gate still records the bake (and keeps the PNG).
      onBaked();
    } finally {
      if (!ctrl.signal.aborted) setRunning(false);
      if (ctrlRef.current === ctrl) ctrlRef.current = null;
    }
  };

  const sealed = canBake === false;
  const ordered = [...presets].sort((a, b) => Number(b.recommended) - Number(a.recommended));

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface/50 px-5 py-4">
      <h3 className="text-xs font-semibold tracking-widest text-muted uppercase">Bake</h3>
      {sealed && (
        <CapabilityNotice
          reason={
            <>
              Live baking is disabled on this host: it paints on a GPU through ComfyUI. Stored bakes, previews and
              archives stay viewable. To enable it, start the server with{" "}
              <span className="font-mono">ATLAS_ALLOW_BAKE=1</span>.
            </>
          }
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Style preset">
          <select value={preset} onChange={(e) => setPreset(e.target.value)} disabled={sealed} className={inputClass}>
            <option value="">none (atlas defaults)</option>
            {ordered.map((p) => (
              <option key={p.name} value={p.name}>
                {p.title}
                {p.recommended ? "" : " (needs the right terrain)"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Checkpoint">
          <input
            value={checkpoint}
            onChange={(e) => setCheckpoint(e.target.value)}
            disabled={sealed}
            placeholder="juggernautXL.safetensors"
            className={inputClass}
          />
        </Field>
        <Field label="Seed (random if empty)">
          <input value={seed} onChange={(e) => setSeed(e.target.value)} disabled={sealed} inputMode="numeric" className={inputClass} />
        </Field>
        <Field label="Cartography LoRA (optional)">
          <input
            value={lora}
            onChange={(e) => setLora(e.target.value)}
            disabled={sealed}
            placeholder="fantasy_map.safetensors"
            className={inputClass}
          />
        </Field>
        <Field label="LoRA weight">
          <input
            value={loraWeight}
            onChange={(e) => setLoraWeight(e.target.value)}
            disabled={sealed || !lora.trim()}
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
      </div>
      {chosen && (
        <p className="text-[11px] leading-relaxed text-muted">
          {chosen.blurb}{" "}
          <span className="ml-1 font-mono">denoise {chosen.denoise} · cfg {chosen.cfg} · {chosen.steps} steps</span>
        </p>
      )}
      <Field label="Prompt override (optional)">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={sealed}
          placeholder={chosen?.prompt ?? "antique fantasy map, ink coastlines…"}
          className={inputClass}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={start}
          disabled={!checkpoint.trim() || running || !permits(canBake)}
          title={canBake === null ? "Checking what this server allows…" : undefined}
          className="rounded-lg bg-accent-blue px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {running ? "Baking…" : "Bake"}
        </button>
        {error && <span className="text-xs text-accent-red">{error}</span>}
      </div>
      {frames.length > 0 && (
        <ol className="space-y-0.5 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[11px]">
          {frames.map((f, i) => (
            <li key={i} className={f.type === "error" ? "text-accent-red" : f.type === "done" ? "text-accent-green" : "text-muted"}>
              <span className="mr-2 inline-block w-24 text-foreground/70">{f.type}</span>
              {f.message}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
