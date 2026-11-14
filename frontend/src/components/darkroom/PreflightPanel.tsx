"use client";

import { ruleLetters } from "@/lib/darkroom/shields";
import type { Preflight } from "@/lib/darkroomApi";

import { PreflightColumn } from "./ShieldGrid";
import { Badge, Card, Notice, SectionTitle } from "./ui";

/**
 * The text-only verdict: one shield per policy, the rule and explanation for
 * any shield that is not green, and the final prompt that was judged. Under
 * an NSFW enforcing policy a non-illegal flag is an amber warning and
 * generation can go ahead.
 */
export function PreflightPanel({ preflight, stale = false }: { preflight: Preflight; stale?: boolean }) {
  const flagged = Object.entries(preflight.results).filter(([, cell]) => cell.state !== "safe");
  const refusal = preflight.refusal;
  const refusingResult = refusal ? preflight.results[refusal.policy]?.result : null;
  return (
    <Card aria-labelledby="preflight-title">
      <div className="flex flex-wrap items-center gap-2">
        <SectionTitle>
          <span id="preflight-title">Pre-flight</span>
        </SectionTitle>
        <Badge className={preflight.outcome === "refused" ? "border-accent-red/50 text-accent-red-ink" : preflight.outcome === "warning" ? "border-accent-amber/50 text-accent-amber-ink" : "border-accent-green/50 text-accent-green-ink"}>{preflight.outcome === "ok" ? "clear" : preflight.outcome}</Badge>
        <Badge className={preflight.mode === "nsfw" ? "border-warm-primary/60 text-warm-primary" : "border-border text-foreground/70"}>{preflight.mode}</Badge>
        {stale ? <span className="text-xs text-muted">The form has changed since this check.</span> : null}
      </div>

      <div className="mt-3 space-y-3">
        {refusal ? (
          <Notice tone="error">
            {refusal.reason === "unchecked" ? (
              <>
                The check under <span className="font-mono">{refusal.policy}</span> did not complete{refusal.explanation ? `: ${refusal.explanation}` : ""}. A failed check is a refusal. Nothing will be generated.
              </>
            ) : (
              <>
                Refused. Rule <strong>{refusal.rule ?? refusal.reason}</strong> fired under <span className="font-mono">{refusal.policy}</span>
                {preflight.results[refusal.policy]?.state === "illegal" ? " (an illegal rule, refused in every mode)" : " (a non-illegal flag; the enforcing policy is SFW, so it blocks)"}. Nothing will be generated.
              </>
            )}
          </Notice>
        ) : null}
        {refusingResult?.explanation ? <blockquote className="whitespace-pre-wrap border-l-2 border-accent-red/50 pl-3 text-sm text-foreground/70">{refusingResult.explanation}</blockquote> : null}
        {preflight.warnings.map((warning) => (
          <Notice key={warning.policy} tone="warning">
            Rule <strong>{warning.rule}</strong> fired under <span className="font-mono">{warning.policy}</span>, an NSFW policy, so this is a warning and generation can proceed. The output scans decide.
            {warning.explanation ? <span className="mt-1 block whitespace-pre-wrap text-foreground/70">{warning.explanation}</span> : null}
          </Notice>
        ))}
        {preflight.outcome === "ok" ? <p className="text-sm text-foreground/70">No rule fired under any selected policy.</p> : null}

        <PreflightColumn results={preflight.results} enforcing={preflight.enforcing_policy} />

        {flagged.length > 0 ? (
          <ul className="space-y-2">
            {flagged
              .filter(([name]) => name !== refusal?.policy && !preflight.warnings.some((warning) => warning.policy === name))
              .map(([name, cell]) => (
                <li key={name} className="rounded-md border border-border/60 bg-surface-hover/40 p-3 text-sm">
                  <p className="text-foreground">
                    <span className="font-mono">{name}</span>
                    {name === preflight.enforcing_policy ? "" : " (advisory, shown not acted on)"}: {cell.state === "unchecked" ? (cell.error ?? "the check did not complete") : `rule ${cell.result?.rules.join("; ") || ruleLetters(cell.result).join(", ")}`}
                  </p>
                  {cell.result?.explanation ? <p className="mt-1 whitespace-pre-wrap text-foreground/70">{cell.result.explanation}</p> : null}
                </li>
              ))}
          </ul>
        ) : null}

        <div className="space-y-2 border-t border-border/40 pt-3">
          {preflight.expanded_prompt != null ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Ollama expansion</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{preflight.expanded_prompt}</p>
            </div>
          ) : null}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Final prompt that was judged</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{preflight.final_prompt}</p>
          </div>
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">Exactly what SingGuard read</summary>
            <pre className="mt-1 whitespace-pre-wrap rounded-md bg-background p-2 font-mono leading-relaxed text-foreground/70">{preflight.framed_text}</pre>
          </details>
        </div>
      </div>
    </Card>
  );
}
