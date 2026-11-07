"use client";

import { policyByName, policySourceLabel, type PolicyChoice } from "@/lib/curatorGuard";
import type { GuardPolicyInfo } from "./types";

interface Props {
  /** What to offer: `offeredPolicies` over `/detectors.singguard_policies`. */
  available: readonly string[];
  choice: PolicyChoice;
  /** `GET /guard/policies`. Null on a curator without it, or until it answers. */
  catalog: readonly GuardPolicyInfo[] | null;
  disabled: boolean;
  onChange: (choice: PolicyChoice) => void;
}

/** Which policies the next scan runs. The official one is what the filters read; variants run beside it to compare. */
export function GuardPolicyPicker({ available, choice, catalog, disabled, onChange }: Props) {
  const names = available.includes(choice.policy) ? available : [choice.policy, ...available];
  const variants = available.filter((name) => name !== choice.policy);
  const wording = policyByName(catalog, choice.policy);
  const passes = 1 + choice.variants.filter((name) => variants.includes(name)).length;
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted" htmlFor="guard-policy">
        SingGuard policy
      </label>
      <select
        id="guard-policy"
        value={choice.policy}
        disabled={disabled}
        onChange={(e) =>
          onChange({ policy: e.target.value, variants: choice.variants.filter((name) => name !== e.target.value) })
        }
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent-teal/50 focus:outline-none disabled:opacity-50"
      >
        {names.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      {variants.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="text-[11px] text-muted">Also run, to compare</legend>
          {variants.map((name) => (
            <label key={name} className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={choice.variants.includes(name)}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    policy: choice.policy,
                    variants: e.target.checked ? [...choice.variants, name] : choice.variants.filter((other) => other !== name),
                  })
                }
                className="h-4 w-4 cursor-pointer accent-accent-teal"
              />
              {name}
            </label>
          ))}
          <p className="text-[11px] text-muted">
            {passes} SingGuard {passes === 1 ? "pass" : "passes"} per image.
          </p>
        </fieldset>
      )}
      {wording && (
        <details className="rounded-lg border border-border bg-background/60 px-2.5 py-1.5">
          <summary className="cursor-pointer text-[11px] text-muted">
            Wording · {policySourceLabel(wording.source)}
            {wording.recorded && wording.recorded !== wording.name ? ` · recorded as ${wording.recorded}` : ""}
          </summary>
          {wording.error && <p className="mt-1.5 text-[11px] text-accent-orange/90">{wording.error}</p>}
          {wording.text ? (
            <pre className="scrollbar-thin mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted">
              {wording.text}
            </pre>
          ) : (
            !wording.error && <p className="mt-1.5 text-[11px] text-muted">This server sends no text, so SingGuard applies its own rules.</p>
          )}
        </details>
      )}
    </div>
  );
}
