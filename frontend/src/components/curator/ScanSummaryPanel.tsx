"use client";

import { setAgeOutcome } from "@/lib/curatorAttributes";
import { policiesRun } from "@/lib/curatorGuard";
import { reasonLabel } from "@/lib/curatorKeepSet";
import { CATEGORY_LABELS, type ScanSummary } from "./types";

interface Props {
  summary: ScanSummary;
}

export function ScanSummaryPanel({ summary }: Props) {
  const rejectEntries = Object.entries(summary.reject_reasons).sort(([, a], [, b]) => b - a);
  const profile = summary.target_profile;
  const cropped = summary.results.filter((row) => row.crop != null).length;
  const setAge = setAgeOutcome(summary);
  const policies = policiesRun(summary);

  return (
    <div className="space-y-5 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Scan Summary</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Total" value={summary.total} color="text-foreground" />
        <Stat label="Passed" value={summary.passed} color="text-accent-green-ink" />
        <Stat label="Rejected" value={summary.rejected} color="text-accent-red-ink" />
        <Stat label="Near-dupes" value={summary.duplicates} color="text-accent-amber-ink" />
        <Stat label="Identities" value={summary.face_clusters.length} color="text-accent-teal-ink" />
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <Badge label="Category" value={CATEGORY_LABELS[profile.target_category]} color="accent-purple" />
        <Badge label="Style" value={profile.target_style} color="accent-teal" />
        {profile.target_backend && <Badge label="Backend" value={profile.target_backend} color="accent-blue" />}
        <Badge label="Diversity" value={summary.config.diversity_weight.toFixed(2)} color="accent-orange" />
        <Badge
          label="Faces"
          value={summary.faces_config.enabled ? summary.faces_config.model : "off"}
          color={summary.faces_config.enabled ? "accent-green" : "accent-amber"}
        />
        <Badge label="Similar clusters" value={String(summary.similar_clusters)} color="accent-amber" />
        {summary.faces_config.fairface && <Badge label="FairFace" value="on" color="accent-green" />}
        {summary.faces_config.mivolo && <Badge label="MiVOLO" value="on" color="accent-green" />}
        {summary.scenes_config?.enabled && <Badge label="Scenes" value="on" color="accent-green" />}
        {summary.garments_config?.enabled && <Badge label="Garments" value="on" color="accent-green" />}
        {summary.nsfw_config?.enabled === true && <Badge label="NudeNet" value="on" color="accent-green" />}
        {summary.erax_config?.enabled === true && <Badge label="EraX" value="on" color="accent-green" />}
        {policies.length > 0 && <Badge label="SingGuard" value={policies.join(", ")} color="accent-green" />}
        {summary.crop_config?.enabled && <Badge label="Cropped" value={String(cropped)} color="accent-teal" />}
      </div>

      {setAge && <p className="text-xs text-muted">{setAge}</p>}

      {rejectEntries.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Reject reasons</div>
          <div className="space-y-1.5">
            {rejectEntries.map(([reason, count]) => {
              const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
              return (
                <div key={reason} className="flex items-center gap-2">
                  <div className="flex-1 truncate text-xs text-foreground/80" title={reason}>
                    {reasonLabel(reason)}
                  </div>
                  <div
                    className="h-1.5 shrink-0 rounded-full bg-accent-red/60"
                    style={{ width: `${Math.max(pct, 2)}%`, maxWidth: "120px" }}
                  />
                  <div className="w-8 shrink-0 text-right font-mono text-xs text-accent-red-ink">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 text-center">
      <div className={`font-mono text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{label}</div>
    </div>
  );
}

function Badge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1">
      <span className="text-muted">{label}:</span>
      <span className={`font-medium text-${color}`}>{value}</span>
    </div>
  );
}
