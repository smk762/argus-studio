"use client";

import {
  CATEGORY_COLORS,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  CATEGORY_COMPOSITION_TIPS,
  TARGET_CATEGORIES,
  type CuratorConfig,
  type TargetCategory,
} from "./types";

const ACCENT_CLASSES: Record<string, { ring: string; text: string; bg: string; border: string }> = {
  "accent-purple": { ring: "ring-accent-purple", text: "text-accent-purple", bg: "bg-accent-purple/20", border: "border-accent-purple/40" },
  "accent-teal": { ring: "ring-accent-teal", text: "text-accent-teal", bg: "bg-accent-teal/20", border: "border-accent-teal/40" },
  "accent-green": { ring: "ring-accent-green", text: "text-accent-green", bg: "bg-accent-green/20", border: "border-accent-green/40" },
  "accent-orange": { ring: "ring-accent-orange", text: "text-accent-orange", bg: "bg-accent-orange/20", border: "border-accent-orange/40" },
};

interface Props {
  value: CuratorConfig;
  onChange: (cfg: CuratorConfig) => void;
  loading: boolean;
}

export function ScanConfigPanel({ value, onChange, loading }: Props) {
  const setProfile = (patch: Partial<CuratorConfig["profile"]>) =>
    onChange({ ...value, profile: { ...value.profile, ...patch } });
  const setConfig = (patch: Partial<CuratorConfig["config"]>) =>
    onChange({ ...value, config: { ...value.config, ...patch } });
  const setFaces = (patch: Partial<CuratorConfig["faces"]>) =>
    onChange({ ...value, faces: { ...value.faces, ...patch } });

  return (
    <div className="space-y-6">
      {/* Target category — drives target-aware scoring + shared with argus-lens */}
      <div>
        <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted">
          Target Category
        </label>
        <div className="grid grid-cols-2 gap-2">
          {TARGET_CATEGORIES.map((cat: TargetCategory) => {
            const ac = ACCENT_CLASSES[CATEGORY_COLORS[cat]];
            const active = value.profile.target_category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setProfile({ target_category: cat })}
                disabled={loading}
                className={`cursor-pointer rounded-lg border p-3 text-left transition-all disabled:opacity-50 ${
                  active ? `${ac.bg} ${ac.border} ring-1 ${ac.ring}` : "border-border bg-surface hover:bg-surface-hover"
                }`}
              >
                <div className={`mb-0.5 text-sm font-semibold ${active ? ac.text : "text-foreground"}`}>
                  {CATEGORY_LABELS[cat]}
                </div>
                <div className="text-[11px] leading-tight text-muted">{CATEGORY_DESCRIPTIONS[cat]}</div>
              </button>
            );
          })}
        </div>
        <p className="mt-2 rounded-lg border border-border bg-background/60 p-2.5 text-[11px] leading-relaxed text-muted">
          {CATEGORY_COMPOSITION_TIPS[value.profile.target_category]}
        </p>
      </div>

      {/* Target style */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">Target Style</label>
        <div className="flex gap-2">
          {(["photo", "anime"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setProfile({ target_style: s })}
              disabled={loading}
              className={`flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                value.profile.target_style === s
                  ? "bg-accent-purple text-white"
                  : "border border-border bg-surface text-foreground hover:bg-surface-hover"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Backend + checkpoint (free text — inherited by argus-lens verbatim) */}
      <div className="space-y-3">
        <TextField
          label="Target backend"
          value={value.profile.target_backend ?? ""}
          placeholder="sdxl"
          onChange={(v) => setProfile({ target_backend: v || null })}
          disabled={loading}
        />
        <TextField
          label="Checkpoint (optional)"
          value={value.profile.checkpoint ?? ""}
          placeholder="e.g. ponyDiffusionV6"
          onChange={(v) => setProfile({ checkpoint: v || null })}
          disabled={loading}
        />
      </div>

      <hr className="border-border" />

      {/* Hard filters */}
      <div>
        <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted">Hard Filters</label>
        <div className="space-y-3">
          <Slider label="Min short side (px)" value={value.config.min_short_side} min={128} max={1024} step={64}
            onChange={(v) => setConfig({ min_short_side: v })} disabled={loading} />
          <Slider label="Max aspect ratio" value={value.config.max_aspect_ratio} min={1} max={6} step={0.5}
            format={(v) => v.toFixed(1)} onChange={(v) => setConfig({ max_aspect_ratio: v })} disabled={loading} />
          <Slider label="Blur threshold (Laplacian var)" value={value.config.blur_threshold} min={10} max={500} step={10}
            onChange={(v) => setConfig({ blur_threshold: v })} disabled={loading} />
        </div>
      </div>

      <hr className="border-border" />

      {/* Dedup + diversity */}
      <div>
        <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted">Dedup &amp; Diversity</label>
        <div className="space-y-3">
          <Slider label="Near-dup distance (pHash)" value={value.config.cluster_distance} min={-1} max={20} step={1}
            format={(v) => (v < 0 ? "off" : String(v))} onChange={(v) => setConfig({ cluster_distance: v })} disabled={loading} />
          <Slider label="Diversity weight" value={value.config.diversity_weight} min={0} max={1} step={0.05}
            format={(v) => v.toFixed(2)} onChange={(v) => setConfig({ diversity_weight: v })} disabled={loading} />
        </div>
      </div>

      <hr className="border-border" />

      {/* Faces (InsightFace, M2) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
            Face Clustering
          </label>
          <Toggle value={value.faces.enabled} onChange={(v) => setFaces({ enabled: v })} disabled={loading} />
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-muted">
          InsightFace <span className="font-mono text-foreground/80">buffalo_l</span> detects + clusters faces into
          identities so you can filter the gallery by face. Requires the curator{" "}
          <span className="font-mono text-foreground/80">[faces]</span> extra.
        </p>
        {value.faces.enabled && (
          <div className="space-y-3">
            <Slider label="Min detection score" value={value.faces.min_det_score} min={0.1} max={0.9} step={0.05}
              format={(v) => v.toFixed(2)} onChange={(v) => setFaces({ min_det_score: v })} disabled={loading} />
            <Slider label="Cluster eps (cosine)" value={value.faces.cluster_eps} min={0.2} max={0.9} step={0.05}
              format={(v) => v.toFixed(2)} onChange={(v) => setFaces({ cluster_eps: v })} disabled={loading} />
            <div>
              <label className="mb-1 block text-sm text-foreground">Device</label>
              <div className="flex gap-2">
                {(["auto", "cpu", "cuda"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setFaces({ device: d })}
                    disabled={loading}
                    className={`flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      value.faces.device === d
                        ? "bg-accent-teal/20 border border-accent-teal/40 text-accent-teal"
                        : "border border-border bg-surface text-muted hover:text-foreground"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TextField({ label, value, placeholder, onChange, disabled }: {
  label: string; value: string; placeholder?: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent-teal/50 focus:outline-none focus:ring-1 focus:ring-accent-teal/50 disabled:opacity-50"
      />
    </div>
  );
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      disabled={disabled}
      aria-pressed={value}
      className={`relative inline-flex h-7 w-12 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
        value ? "bg-accent-teal" : "bg-border"
      }`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function Slider({ label, value, min, max, step, format, onChange, disabled }: {
  label: string; value: number; min: number; max: number; step: number;
  format?: (v: number) => string; onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-foreground">{label}</span>
        <span className="font-mono text-sm text-accent-teal">{format ? format(value) : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer accent-accent-teal disabled:opacity-50"
      />
    </div>
  );
}
