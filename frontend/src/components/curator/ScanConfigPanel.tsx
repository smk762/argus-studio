"use client";

import {
  CATEGORY_COLORS,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  CATEGORY_COMPOSITION_TIPS,
  TARGET_CATEGORIES,
  MIN_SHORT_SIDE,
  clampShortSide,
  type CuratorConfig,
  type Detectors,
  type GuardPolicyInfo,
  type TargetCategory,
} from "./types";
import {
  allowsCrops,
  allowsPrefilter,
  allowsSetAge,
  allowsWatermarkDetect,
  CROPS_DENIED,
  PREFILTER_DENIED,
  SET_AGE_DENIED,
  WATERMARK_DENIED,
  type Health,
} from "@/lib/curatorApi";
import { capabilityReason, permits } from "@/lib/capabilities";
import { GuardPolicyPicker } from "./GuardPolicyPicker";

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
  /** `/detectors`. Null until known, which offers nothing a curator may not have. */
  detectors: Detectors | null;
  health: Health | null;
  /** Policy wording from `GET /guard/policies`. Null when this curator has none. */
  policyCatalog: readonly GuardPolicyInfo[] | null;
}

export function ScanConfigPanel({ value, onChange, loading, detectors, health, policyCatalog }: Props) {
  const setProfile = (patch: Partial<CuratorConfig["profile"]>) =>
    onChange({ ...value, profile: { ...value.profile, ...patch } });
  const setConfig = (patch: Partial<CuratorConfig["config"]>) =>
    onChange({ ...value, config: { ...value.config, ...patch } });
  const setFaces = (patch: Partial<CuratorConfig["faces"]>) =>
    onChange({ ...value, faces: { ...value.faces, ...patch } });
  const setScenes = (patch: Partial<CuratorConfig["scenes"]>) =>
    onChange({ ...value, scenes: { ...value.scenes, ...patch } });
  const setGarments = (patch: Partial<CuratorConfig["garments"]>) =>
    onChange({ ...value, garments: { ...value.garments, ...patch } });
  const setPrefilter = (patch: Partial<CuratorConfig["prefilter"]>) =>
    onChange({ ...value, prefilter: { ...value.prefilter, ...patch } });
  const setCrops = (patch: Partial<CuratorConfig["crops"]>) =>
    onChange({ ...value, crops: { ...value.crops, ...patch } });

  const setAge = allowsSetAge(health);
  const setAgeReason = capabilityReason(setAge, SET_AGE_DENIED);
  const prefilter = allowsPrefilter(health);
  const prefilterReason = capabilityReason(prefilter, PREFILTER_DENIED);
  const crops = allowsCrops(health);
  const cropsReason = capabilityReason(crops, CROPS_DENIED);
  const watermarks = allowsWatermarkDetect(health);
  const watermarkReason =
    capabilityReason(watermarks, WATERMARK_DENIED) ??
    (detectors && !detectors.watermark ? "Set ARGUS_CURATOR_WATERMARK_URL on the curator to find watermarks." : null);

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
          <Slider
            label="Min short side (px)"
            value={Math.max(MIN_SHORT_SIDE, value.config.min_short_side)}
            min={MIN_SHORT_SIDE}
            max={1024}
            step={64}
            onChange={(v) => setConfig({ min_short_side: clampShortSide(v) })}
            disabled={loading}
          />
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
          <Toggle
            value={value.faces.enabled}
            onChange={(v) =>
              setFaces(v ? { enabled: true } : { enabled: false, fairface: false, mivolo: false, set_age: false, mivolo_body: false })
            }
            disabled={loading}
          />
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
            {detectors?.fairface && (
              <Check
                label="FairFace attributes"
                checked={value.faces.fairface === true}
                onChange={(v) => setFaces({ fairface: v })}
                disabled={loading}
                hint="Predicted race, gender and age bracket for each face. A guess from appearance, not a fact about anyone."
              />
            )}
            {detectors?.mivolo && (
              <Check
                label="MiVOLO ages"
                checked={value.faces.mivolo === true}
                onChange={(v) =>
                  setFaces(v ? { mivolo: true } : { mivolo: false, set_age: false, mivolo_body: false })
                }
                disabled={loading}
                hint="An age in years for each face. It is a model's estimate, and the under-18 rule reads it."
              />
            )}
            {detectors?.mivolo && (
              <Check
                label="Set: one person"
                checked={value.faces.set_age === true}
                onChange={(v) => setFaces({ set_age: v, mivolo: v ? true : value.faces.mivolo })}
                disabled={loading || !permits(setAge)}
                hint={setAgeReason ?? "For a folder of one person: frames with no face take the set's age, so the under-18 rule has something to read. A mixed folder gets nothing."}
              />
            )}
            {detectors?.mivolo && detectors.bodies && (
              <Check
                label="Read bodies too"
                checked={value.faces.mivolo_body === true}
                onChange={(v) => setFaces({ mivolo_body: v, mivolo: v ? true : value.faces.mivolo })}
                disabled={loading}
                hint="Under evaluation. MiVOLO reads each person's body as well, and a person with no face gets a body-only age."
              />
            )}
          </div>
        )}
      </div>

      <hr className="border-border" />

      {(detectors?.places365 || detectors?.garments) && (
        <>
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Scenes &amp; Wardrobe</label>
            {detectors.places365 && (
              <Check
                label="Scenes (Places365)"
                checked={value.scenes.enabled}
                onChange={(v) => setScenes({ enabled: v })}
                disabled={loading}
                hint="Scene labels and indoor or outdoor for each frame."
              />
            )}
            {value.scenes.enabled && (
              <Slider label="Labels per frame" value={value.scenes.top_k} min={1} max={20} step={1}
                onChange={(v) => setScenes({ top_k: v })} disabled={loading} />
            )}
            {detectors.garments && (
              <Check
                label="Garments (Fashionpedia)"
                checked={value.garments.enabled}
                onChange={(v) => setGarments({ enabled: v })}
                disabled={loading}
                hint="The slowest local check. Needed for the wardrobe facets and spreading across outfits."
              />
            )}
            {value.garments.enabled && (
              <Slider label="Record from confidence" value={value.garments.min_conf} min={0} max={1} step={0.05}
                format={(v) => v.toFixed(2)} onChange={(v) => setGarments({ min_conf: v })} disabled={loading} />
            )}
          </div>
          <hr className="border-border" />
        </>
      )}

      {detectors?.singguard && (detectors.singguard_policies?.length ?? 0) > 0 && (
        <>
          <GuardPolicyPicker
            available={detectors.singguard_policies ?? []}
            choice={value.guard}
            catalog={policyCatalog}
            disabled={loading}
            onChange={(guard) => onChange({ ...value, guard })}
          />
          <hr className="border-border" />
        </>
      )}

      {/* Prefilter: reject early, so scenes, garments and SingGuard skip the frame. */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">Prefilter</label>
        <p className="mb-3 text-[11px] leading-relaxed text-muted">
          A dropped frame skips the late checks and stays in the scan as a{" "}
          <span className="font-mono text-foreground/80">prefilter:*</span> reject, so it is never exported.
        </p>
        <div className="space-y-2">
          <Check
            label="Drop exposed"
            checked={value.prefilter.drop_nsfw}
            onChange={(v) => setPrefilter({ drop_nsfw: v })}
            disabled={loading || !permits(prefilter)}
            hint={prefilterReason ?? "An exposed reading of 0.2 or more. A frame that could not be scored is kept. Needs NudeNet."}
          />
          <Check
            label="Drop no face"
            checked={value.prefilter.drop_no_face}
            onChange={(v) => setPrefilter({ drop_no_face: v })}
            disabled={loading || !permits(prefilter)}
            hint={prefilterReason ?? "No face detected. A frame whose detection failed is kept. Needs Face Clustering."}
          />
          <Check
            label="Drop no age"
            checked={value.prefilter.drop_no_age}
            onChange={(v) => setPrefilter({ drop_no_age: v })}
            disabled={loading || !permits(prefilter)}
            hint={prefilterReason ?? "No MiVOLO age on a face or body, and no set age. Needs MiVOLO ages."}
          />
        </div>
      </div>

      <hr className="border-border" />

      {/* Crops: applied in memory, so every check sees the cropped frame. */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Crops</label>
          <Toggle
            value={value.crops.enabled}
            onChange={(v) => setCrops({ enabled: v })}
            disabled={loading || !permits(crops)}
            title={cropsReason ?? undefined}
          />
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-muted">
          Every check sees the cropped frame, and the source is never changed. A scan that cropped any image exports by
          copy only.
        </p>
        {value.crops.enabled && (
          <div className="space-y-3">
            <Check
              label="Read .crop.json sidecars"
              checked={value.crops.sidecars}
              onChange={(v) => setCrops({ sidecars: v })}
              disabled={loading}
              hint="A box recorded beside an image, in its displayed pixels."
            />
            <Check
              label="Detect watermarks"
              checked={value.crops.detect}
              onChange={(v) => setCrops({ detect: v })}
              disabled={loading || !permits(watermarks) || watermarkReason !== null}
              hint={watermarkReason ?? "Frames without a box go to the watermark detector, and its hits are cut away at the edges."}
            />
            {value.crops.detect && (
              <>
                <Slider label="Min confidence" value={value.crops.min_conf} min={0} max={1} step={0.05}
                  format={(v) => v.toFixed(2)} onChange={(v) => setCrops({ min_conf: v })} disabled={loading} />
                <Slider label="Most one edge may lose" value={value.crops.max_cut} min={0.05} max={0.45} step={0.01}
                  format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setCrops({ max_cut: v })} disabled={loading} />
                <Slider label="Margin (px)" value={value.crops.margin} min={0} max={32} step={1}
                  onChange={(v) => setCrops({ margin: v })} disabled={loading} />
                <Check
                  label="Reject overlays"
                  checked={value.crops.reject_overlay}
                  onChange={(v) => setCrops({ reject_overlay: v })}
                  disabled={loading}
                  hint="A hit no edge cut removes rejects the frame as crop:overlay. Off, it is kept uncropped with its hits recorded."
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Check({ label, checked, onChange, disabled, hint }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint: string;
}) {
  return (
    <label className={`flex items-start gap-2 text-sm text-foreground ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`} title={hint}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-accent-teal disabled:cursor-not-allowed"
      />
      <span className="min-w-0">
        {label}
        <span className="block text-[11px] leading-snug text-muted">{hint}</span>
      </span>
    </label>
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

function Toggle({ value, onChange, disabled, title }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      disabled={disabled}
      title={title}
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
