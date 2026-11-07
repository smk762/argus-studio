"use client";

import { useMemo } from "react";
import { attributeLine } from "@/lib/curatorAttributes";
import { facetCounts, rankedLabels, slugLabel } from "@/lib/curatorFacets";
import { matchesGuardView, policiesRun, policyFlagCounts, ruleCounts, shieldState, type GuardView } from "@/lib/curatorGuard";
import { ratingCounts } from "@/lib/curatorModeration";
import { scanCheckedNsfw, thumbSafety } from "@/lib/curatorSafety";
import { ThumbImage } from "./ThumbImage";
import {
  CONTENT_RATINGS,
  FACE_AGES,
  FACE_GENDERS,
  FACE_POSES,
  FACE_RACES,
  POSE_LABELS,
  SCENE_ENVIRONMENTS,
  type CuratorFilters,
  type FacePose,
  type ScanSummary,
} from "./types";

interface Props {
  summary: ScanSummary;
  filters: CuratorFilters;
  onChange: (f: CuratorFilters) => void;
  visibleCount: number;
  /** Checks still running. Empty once the scan has finished. */
  pending?: readonly string[];
}

export function FacetRail({ summary, filters, onChange, visibleCount, pending = [] }: Props) {
  const set = (patch: Partial<CuratorFilters>) => onChange({ ...filters, ...patch });

  const toggleCluster = (id: string) => {
    const has = filters.faceClusters.includes(id);
    set({
      faceClusters: has
        ? filters.faceClusters.filter((c) => c !== id)
        : [...filters.faceClusters, id],
    });
  };

  const togglePose = (p: FacePose) => {
    const has = filters.poses.includes(p);
    set({ poses: has ? filters.poses.filter((x) => x !== p) : [...filters.poses, p] });
  };

  const hasFaces = summary.faces_config.enabled && summary.face_clusters.length > 0;

  const poseCounts = summary.results.reduce<Record<string, number>>((acc, r) => {
    if (r.primary_face_pose) acc[r.primary_face_pose] = (acc[r.primary_face_pose] ?? 0) + 1;
    return acc;
  }, {});
  const hasPoses = Object.keys(poseCounts).length > 0;

  const counts = useMemo(
    () => facetCounts(summary.results, filters.minSceneConf, filters.minGarmentConf),
    [summary.results, filters.minSceneConf, filters.minGarmentConf],
  );
  const recorded = useMemo(() => facetCounts(summary.results, 0, 0), [summary.results]);
  const hasAttributes = recorded.races.size + recorded.genders.size + recorded.ages.size + recorded.yearsKnown > 0;
  const hasScenes = recorded.scenes.size + recorded.environments.size > 0;
  const hasGarments = recorded.garments.size > 0;
  const garmentFloor = summary.garments_config?.min_conf ?? 0;
  const ratings = useMemo(() => ratingCounts(summary.results), [summary.results]);
  const nsfwRan = scanCheckedNsfw(summary);
  const official = summary.guard_config?.policy ?? null;
  const policies = useMemo(() => policiesRun(summary), [summary]);
  const rules = useMemo(() => ruleCounts(summary.results, official), [summary.results, official]);
  const flags = useMemo(() => policyFlagCounts(summary.results, official), [summary.results, official]);
  const views = useMemo(() => {
    const states = summary.results.map((row) => shieldState(row, official));
    const count = (view: GuardView) => states.filter((state) => matchesGuardView(state, view)).length;
    return { all: states.length, unsafe: count("unsafe"), split: count("split"), safe: count("safe") };
  }, [summary.results, official]);
  const flip = <T,>(values: readonly T[], value: T): T[] =>
    values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

  return (
    <div className="space-y-5 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Facets</h3>
        <span className="text-[11px] text-muted">{visibleCount} shown</span>
      </div>

      {/* Face clusters */}
      {hasFaces && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Identity</span>
            {filters.faceClusters.length > 0 && (
              <button
                type="button"
                onClick={() => set({ faceClusters: [] })}
                className="cursor-pointer text-[10px] text-accent-teal hover:underline"
              >
                clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {summary.face_clusters.map((fc) => {
              const active = filters.faceClusters.includes(fc.cluster_id);
              const rep = summary.results.find((r) => r.rel_path === fc.representative_rel_path);
              // A representative this page does not hold has not been checked.
              const blurred = rep ? thumbSafety(rep, scanCheckedNsfw(summary), pending).blurred : true;
              const pooled = attributeLine(fc.attributes);
              return (
                <button
                  key={fc.cluster_id}
                  type="button"
                  onClick={() => toggleCluster(fc.cluster_id)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-1.5 text-left transition-all ${
                    active
                      ? "border-accent-teal/50 bg-accent-teal/10 ring-1 ring-accent-teal/40"
                      : "border-border bg-background hover:bg-surface-hover"
                  }`}
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md">
                    <div className={blurred ? "h-full w-full scale-105 blur-md" : "h-full w-full"} title={blurred ? "Blurred" : undefined}>
                      <ThumbImage
                        scanId={summary.scan_id}
                        relPath={fc.representative_rel_path}
                        faceCluster={fc.cluster_id}
                        rounded="rounded-md"
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[11px] text-foreground">{fc.cluster_id}</div>
                    <div className="text-[10px] text-muted">{fc.size} faces</div>
                    {pooled && (
                      <div className="truncate text-[10px] text-muted" title={`${pooled}. A model's guess.`}>
                        {pooled}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Head pose */}
      {hasPoses && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Head pose</span>
            {filters.poses.length > 0 && (
              <button
                type="button"
                onClick={() => set({ poses: [] })}
                className="cursor-pointer text-[10px] text-accent-teal hover:underline"
              >
                clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {FACE_POSES.map((p) => {
              const active = filters.poses.includes(p);
              const count = poseCounts[p] ?? 0;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={count === 0}
                  onClick={() => togglePose(p)}
                  className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                    active
                      ? "border-accent-purple/50 bg-accent-purple/10 ring-1 ring-accent-purple/40"
                      : "border-border bg-background hover:bg-surface-hover"
                  }`}
                >
                  <span className="text-[11px] font-medium text-foreground">{POSE_LABELS[p]}</span>
                  <span className="font-mono text-[10px] text-muted">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasAttributes && (
        <FacetGroup
          title="Appearance"
          note="A model's guess from appearance, not a fact about anyone. Reads the primary face."
          active={
            filters.faceRaces.length + filters.faceGenders.length + filters.faceAges.length > 0 ||
            filters.minAgeYears != null ||
            filters.maxAgeYears != null
          }
          onClear={() => set({ faceRaces: [], faceGenders: [], faceAges: [], minAgeYears: null, maxAgeYears: null })}
        >
          <Chips
            options={FACE_GENDERS}
            selected={filters.faceGenders}
            count={(v) => recorded.genders.get(v) ?? 0}
            onToggle={(v) => set({ faceGenders: flip(filters.faceGenders, v) })}
          />
          <Chips
            options={FACE_AGES}
            selected={filters.faceAges}
            count={(v) => recorded.ages.get(v) ?? 0}
            onToggle={(v) => set({ faceAges: flip(filters.faceAges, v) })}
          />
          <Chips
            options={FACE_RACES}
            selected={filters.faceRaces}
            count={(v) => recorded.races.get(v) ?? 0}
            onToggle={(v) => set({ faceRaces: flip(filters.faceRaces, v) })}
          />
          {recorded.yearsKnown > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <YearField label="Min years" value={filters.minAgeYears} onChange={(v) => set({ minAgeYears: v })} />
              <YearField label="Max years" value={filters.maxAgeYears} onChange={(v) => set({ maxAgeYears: v })} />
            </div>
          )}
          <ConfSlider label="Attribute confidence" value={filters.minAttributeConf} onChange={(v) => set({ minAttributeConf: v })} />
        </FacetGroup>
      )}

      {hasScenes && (
        <FacetGroup
          title="Scene"
          active={filters.scenes.length + filters.sceneEnvironments.length > 0}
          onClear={() => set({ scenes: [], sceneEnvironments: [] })}
        >
          <Chips
            options={SCENE_ENVIRONMENTS}
            selected={filters.sceneEnvironments}
            count={(v) => counts.environments.get(v) ?? 0}
            onToggle={(v) => set({ sceneEnvironments: flip(filters.sceneEnvironments, v) })}
          />
          <Chips
            options={rankedLabels(counts.scenes, filters.scenes)}
            selected={filters.scenes}
            count={(v) => counts.scenes.get(v) ?? 0}
            onToggle={(v) => set({ scenes: flip(filters.scenes, v) })}
          />
          <ConfSlider label="Scene confidence" value={filters.minSceneConf} onChange={(v) => set({ minSceneConf: v })} />
        </FacetGroup>
      )}

      {hasGarments && (
        <FacetGroup
          title="Wardrobe"
          active={filters.garments.length + filters.excludeGarments.length > 0}
          onClear={() => set({ garments: [], excludeGarments: [] })}
        >
          <span className="block text-[10px] text-muted">Wearing</span>
          <Chips
            options={rankedLabels(counts.garments, filters.garments)}
            selected={filters.garments}
            count={(v) => counts.garments.get(v) ?? 0}
            onToggle={(v) => set({ garments: flip(filters.garments, v) })}
          />
          <span className="block text-[10px] text-muted">Not wearing</span>
          <Chips
            options={rankedLabels(counts.garments, filters.excludeGarments)}
            selected={filters.excludeGarments}
            count={(v) => counts.garments.get(v) ?? 0}
            onToggle={(v) => set({ excludeGarments: flip(filters.excludeGarments, v) })}
          />
          <Check
            label="Not cut off by the frame"
            checked={filters.garmentsUncropped}
            onChange={(v) => set({ garmentsUncropped: v })}
          />
          <ConfSlider
            label="Garment confidence"
            value={Math.max(filters.minGarmentConf, garmentFloor)}
            min={garmentFloor}
            onChange={(v) => set({ minGarmentConf: v })}
          />
        </FacetGroup>
      )}

      {(nsfwRan || ratings.safe + ratings.suggestive + ratings.explicit > 0) && (
        <FacetGroup
          title="Content rating"
          note={`From NudeNet. ${ratings.unchecked} not checked, which is not the same as safe.`}
          active={filters.contentRatings.length > 0}
          onClear={() => set({ contentRatings: [] })}
        >
          <Chips
            options={CONTENT_RATINGS}
            selected={filters.contentRatings}
            count={(v) => ratings[v]}
            onToggle={(v) => set({ contentRatings: flip(filters.contentRatings, v) })}
          />
        </FacetGroup>
      )}

      {policies.length > 0 && (
        <FacetGroup
          title="SingGuard"
          active={filters.guardUnsafe || filters.guardRules.length + filters.guardPolicies.length > 0 || filters.guardView !== "all"}
          onClear={() => set({ guardUnsafe: false, guardRules: [], guardPolicies: [], guardView: "all" })}
        >
          <label className="block text-[10px] text-muted">
            Show
            <select
              aria-label="Show by verdict"
              value={filters.guardView}
              onChange={(e) => set({ guardView: e.target.value as GuardView })}
              className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
            >
              <option value="all">All ({views.all})</option>
              <option value="unsafe">Unsafe ({views.unsafe})</option>
              <option value="split">Policies disagree ({views.split})</option>
              <option value="safe">Safe ({views.safe})</option>
            </select>
          </label>
          <Check
            label="Drop every unsafe verdict"
            checked={filters.guardUnsafe}
            onChange={(v) => set({ guardUnsafe: v, guardRules: v ? [] : filters.guardRules })}
          />
          {rules.size > 0 && (
            <>
              <span className="block text-[10px] text-muted">Drop these rules</span>
              <div className="scrollbar-thin max-h-32 space-y-1 overflow-y-auto">
                {rankedLabels(rules, filters.guardRules).map((rule) => (
                  <label key={rule} className="flex cursor-pointer items-start gap-2 text-[11px] text-foreground" title={rule}>
                    <input
                      type="checkbox"
                      checked={filters.guardRules.includes(rule)}
                      onChange={() => set({ guardUnsafe: false, guardRules: flip(filters.guardRules, rule) })}
                      className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-accent-teal"
                    />
                    <span className="min-w-0">
                      {rule} <span className="font-mono text-[10px] text-muted">{rules.get(rule) ?? 0}</span>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
          {policies.length > 1 && (
            <>
              <span className="block text-[10px] text-muted" title="Empty reads the official policy. A frame drops when any listed policy fails it.">
                Read verdicts from
              </span>
              <div className="flex flex-wrap gap-1">
                {policies.map((policy, i) => {
                  const on = filters.guardPolicies.includes(policy);
                  return (
                    <button
                      key={policy}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ guardPolicies: flip(filters.guardPolicies, policy) })}
                      title={i === 0 ? "The official policy" : "A variant"}
                      className={`cursor-pointer rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${
                        on ? "border-accent-teal/50 bg-accent-teal/10 text-accent-teal" : "border-border bg-background text-foreground/85"
                      }`}
                    >
                      {policy} {flags.get(policy) ?? 0}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </FacetGroup>
      )}

      {/* Score range */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Min score</span>
          <span className="font-mono text-xs text-accent-teal">{filters.minScore.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={filters.minScore}
          onChange={(e) => set({ minScore: parseFloat(e.target.value) })}
          className="w-full cursor-pointer accent-accent-teal"
        />
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <Check label="Passed only" checked={filters.passedOnly} onChange={(v) => set({ passedOnly: v })} />
        <Check label="Hide near-duplicates" checked={filters.hideDuplicates} onChange={(v) => set({ hideDuplicates: v })} />
        {hasFaces && (
          <>
            <Check label="Single-face only" checked={filters.singleFaceOnly} onChange={(v) => set({ singleFaceOnly: v })} />
            <Check label="Require a known face" checked={filters.requireKnownFace} onChange={(v) => set({ requireKnownFace: v })} />
          </>
        )}
      </div>
    </div>
  );
}

function FacetGroup({ title, note, active, onClear, children }: {
  title: string;
  note?: string;
  active: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted" title={note}>
          {title}
        </span>
        {active && (
          <button type="button" onClick={onClear} className="cursor-pointer text-[10px] text-accent-teal hover:underline">
            clear
          </button>
        )}
      </div>
      {note && <p className="text-[10px] leading-snug text-muted">{note}</p>}
      {children}
    </div>
  );
}

/** Options with no frame are left out, unless ticked, so a long vocabulary shows what this scan holds. */
function Chips<T extends string>({ options, selected, count, onToggle }: {
  options: readonly T[];
  selected: readonly T[];
  count: (value: T) => number;
  onToggle: (value: T) => void;
}) {
  const shown = options.filter((option) => count(option) > 0 || selected.includes(option));
  if (shown.length === 0) return null;
  return (
    <div className="scrollbar-thin flex max-h-32 flex-wrap gap-1 overflow-y-auto">
      {shown.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(option)}
            className={`cursor-pointer rounded-md border px-1.5 py-0.5 text-[11px] transition-colors ${
              active
                ? "border-accent-teal/50 bg-accent-teal/10 text-accent-teal"
                : "border-border bg-background text-foreground/85 hover:bg-surface-hover"
            }`}
          >
            {slugLabel(option)} <span className="font-mono text-[10px] text-muted">{count(option)}</span>
          </button>
        );
      })}
    </div>
  );
}

function ConfSlider({ label, value, min = 0, onChange }: {
  label: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] text-muted">{label}</span>
        <span className="font-mono text-xs text-accent-teal">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={1}
        step={0.05}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer accent-accent-teal"
      />
    </div>
  );
}

function YearField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="text-[10px] text-muted">
      {label}
      <input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-accent-teal/50 focus:outline-none"
      />
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-accent-teal"
      />
      {label}
    </label>
  );
}
