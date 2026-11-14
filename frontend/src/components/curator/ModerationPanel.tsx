"use client";

import { policyShields, policyVerdicts } from "@/lib/curatorGuard";
import { contentRating, eraxRows, nudenetRows, scoreSource } from "@/lib/curatorModeration";
import { GuardShield } from "./GuardShield";
import type { ImageResult } from "./types";

interface Props {
  img: ImageResult;
  /** Policies the scan ran, official first. */
  policies: readonly string[];
  officialPolicy: string | null;
  /** The finished scan ran NudeNet, so a missing reading is a gap, not a skipped check. */
  nsfwRan: boolean;
  /** The frame is held. SingGuard's writeup describes the picture, so it stays out. */
  held: boolean;
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="space-y-1">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 text-xs">
          <dt className="min-w-0 truncate text-muted">{k}</dt>
          <dd className="shrink-0 font-mono text-foreground/90">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** What each detector said about a frame. Text only, so it can sit beside a covered thumbnail. */
export function ModerationPanel({ img, policies, officialPolicy, nsfwRan, held }: Props) {
  const nudenet = nudenetRows(img);
  const erax = eraxRows(img);
  const verdicts = policyVerdicts(img, officialPolicy);
  const shields = policyShields(img, policies, officialPolicy);
  const source = scoreSource(img);
  const rating = contentRating(img);
  if (!nudenet && !erax && verdicts.length === 0 && !nsfwRan) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/50 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted">Moderation</h3>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium text-foreground/85">NudeNet</span>
          <span className="text-muted">{rating ?? "not scored"}</span>
        </div>
        {nudenet ? <Rows rows={nudenet} /> : <p className="text-xs text-muted">No reading. That does not mean clear.</p>}
        {source && <p className="text-[11px] leading-snug text-accent-orange-ink">{source}</p>}
      </div>

      {erax && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-foreground/85">EraX</span>
          {erax.length > 0 ? <Rows rows={erax} /> : <p className="text-xs text-muted">Nothing found.</p>}
        </div>
      )}

      {verdicts.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-foreground/85">SingGuard</span>
          {verdicts.map((verdict) => {
            const shield = shields.find((entry) => entry.policy === verdict.policy);
            return (
              <div key={verdict.policy} className="space-y-0.5 text-xs">
                <div className="flex items-center gap-1.5">
                  {shield && <GuardShield shield={shield} />}
                  <span className="min-w-0 truncate font-mono text-foreground/90">{verdict.policy}</span>
                  {verdict.official && <span className="text-[10px] text-accent-teal-ink">official</span>}
                  <span className={`ml-auto shrink-0 ${verdict.result.safe ? "text-accent-green-ink" : "text-accent-red-ink"}`}>
                    {verdict.result.safe ? "safe" : "unsafe"}
                  </span>
                </div>
                {(verdict.result.rules ?? []).map((rule) => (
                  <p key={rule} className="text-accent-red-ink">
                    {rule}
                  </p>
                ))}
                {(verdict.result.thinking || verdict.result.model) && (
                  <p className="text-[10px] text-muted">
                    {[verdict.result.thinking && `${verdict.result.thinking} pass`, verdict.result.model].filter(Boolean).join(" · ")}
                  </p>
                )}
                {verdict.result.explanation && !held && (
                  <details className="text-[11px] text-muted">
                    <summary className="cursor-pointer">Explanation</summary>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed">{verdict.result.explanation}</p>
                  </details>
                )}
              </div>
            );
          })}
          {held && verdicts.some((verdict) => verdict.result.explanation) && (
            <p className="text-[11px] text-muted">The explanation stays hidden while this frame is held.</p>
          )}
        </div>
      )}
    </div>
  );
}
