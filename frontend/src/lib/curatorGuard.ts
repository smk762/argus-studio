/**
 * SingGuard verdicts. A rule is only ever the string the verdict recorded: a
 * letter means different things under different policies (`adult-cinematic`'s B
 * to G differ from the other adult policies'), so nothing here names one.
 *
 * Verdicts are shown as recorded. The curator's filters read `safe` as recorded
 * too, so reinterpreting a verdict here would make the grid disagree with them.
 */

import type { CuratorFilters, GuardConfig, GuardPolicyInfo, GuardResult, ImageResult, ScanSummary } from "@/components/curator/types";

type Guarded = Pick<ImageResult, "guard" | "guard_variants">;

export interface PolicyVerdict {
  policy: string;
  result: GuardResult;
  official: boolean;
}

/**
 * Every verdict on a frame, official first. `guard_variants` holds the official
 * one too, under the name the scan asked for. That name is `official`, since
 * `guard.policy` may be a recorded `custom-<hash>` instead.
 */
export function policyVerdicts(img: Guarded, official?: string | null): PolicyVerdict[] {
  const name = official ?? img.guard?.policy ?? "default";
  const out: PolicyVerdict[] = img.guard ? [{ policy: name, result: img.guard, official: true }] : [];
  for (const [policy, result] of Object.entries(img.guard_variants ?? {})) {
    if (policy !== name && result != null) out.push({ policy, result, official: false });
  }
  return out;
}

/** The policies this scan ran, official first. None when SingGuard did not: the config names one regardless. */
export function policiesRun(summary: Pick<ScanSummary, "guard_config">): string[] {
  const config = summary.guard_config;
  if (config?.enabled !== true) return [];
  return [config.policy, ...(config.variants ?? []).filter((name) => name !== config.policy)];
}

export type ShieldState = "none" | "safe" | "safe-split" | "unsafe" | "unsafe-split";

/** The official verdict, and whether another policy disagreed with it. */
export function shieldState(img: Guarded, official?: string | null): ShieldState {
  const verdicts = policyVerdicts(img, official);
  if (verdicts.length === 0) return "none";
  const lead = verdicts[0];
  const split = verdicts.some((verdict) => verdict.result.safe !== lead.result.safe);
  if (lead.result.safe) return split ? "safe-split" : "safe";
  return split ? "unsafe-split" : "unsafe";
}

export type GuardView = "all" | "unsafe" | "split" | "safe";

/** Queries, not a partition: split overlaps both. A frame with no verdict shows only under `all`. */
export function matchesGuardView(state: ShieldState, view: GuardView): boolean {
  if (view === "all") return true;
  if (view === "split") return state === "safe-split" || state === "unsafe-split";
  return state === view || state === `${view}-split`;
}

export interface PolicyShield {
  policy: string;
  state: "pending" | "safe" | "unsafe";
  title: string;
}

/** One mark per policy: its own verdict, with the rules it fired. A policy with no verdict shows only while the check runs. */
export function policyShields(
  img: Guarded,
  policies: readonly string[],
  official?: string | null,
  checking = false,
): PolicyShield[] {
  const verdicts = policyVerdicts(img, official);
  const names = [...policies, ...verdicts.map((verdict) => verdict.policy).filter((name) => !policies.includes(name))];
  return names.flatMap((policy): PolicyShield[] => {
    const verdict = verdicts.find((entry) => entry.policy === policy);
    if (!verdict) return checking ? [{ policy, state: "pending", title: `${policy}: waiting for a verdict` }] : [];
    if (verdict.result.safe) return [{ policy, state: "safe", title: `${policy}: safe` }];
    const rules = (verdict.result.rules ?? []).join("; ") || "no rule named";
    return [{ policy, state: "unsafe", title: `${policy}: unsafe. ${rules}` }];
  });
}

/** Frames per recorded rule, across every policy's unsafe verdicts. A frame counts once per rule. */
export function ruleCounts(results: readonly ImageResult[], official?: string | null): Map<string, number> {
  const counts = new Map<string, number>();
  for (const img of results) {
    const fired = policyVerdicts(img, official).flatMap((verdict) => (verdict.result.safe ? [] : (verdict.result.rules ?? [])));
    for (const rule of new Set(fired)) counts.set(rule, (counts.get(rule) ?? 0) + 1);
  }
  return counts;
}

/** Frames each policy flagged. */
export function policyFlagCounts(results: readonly ImageResult[], official?: string | null): Map<string, number> {
  const counts = new Map<string, number>();
  for (const img of results) {
    for (const verdict of policyVerdicts(img, official)) {
      if (!verdict.result.safe) counts.set(verdict.policy, (counts.get(verdict.policy) ?? 0) + 1);
    }
  }
  return counts;
}

/** The curator's `rule_matches`, for a wanted rule in full. */
function ruleMatches(fired: string, wanted: string): boolean {
  const a = fired.trim().toLowerCase();
  const b = wanted.trim().toLowerCase();
  return a === b || a.startsWith(`${b.replace(/\.$/, "")}.`);
}

function verdictPasses(verdict: GuardResult | null | undefined, f: CuratorFilters): boolean {
  if (verdict == null) return false;
  if (verdict.safe) return true;
  if (f.guardUnsafe) return false;
  const rules = verdict.rules ?? [];
  // It names no rule, so it cannot be shown to be unlisted.
  if (rules.length === 0) return false;
  return !f.guardRules.some((wanted) => rules.some((fired) => ruleMatches(fired, wanted)));
}

/** Mirrors the curator's `_guard_exclusion`. A frame with no verdict is left out, as with NudeNet. */
export function guardFilterMatches(img: Guarded, f: CuratorFilters): boolean {
  if (!f.guardUnsafe && f.guardRules.length === 0) return true;
  if (f.guardPolicies.length === 0) return verdictPasses(img.guard, f);
  return f.guardPolicies.every((name) =>
    // A scan without variants has only the official verdict.
    verdictPasses(img.guard_variants != null ? img.guard_variants[name] : img.guard, f),
  );
}

export interface PolicyChoice {
  policy: string;
  variants: string[];
}

/** Why the form's policies can't run on this server, or null. Again can bring back a name from another one. */
export function guardProblem(choice: PolicyChoice, available: readonly string[]): string | null {
  if (available.length === 0) return null;
  const missing = [choice.policy, ...choice.variants].find((name) => !available.includes(name));
  return missing ? `This curator does not offer the policy ${missing}.` : null;
}

/** The scan's `guard` block, or null for the curator's default: an older curator ignores it and would use its default silently. */
export function guardBody(choice: PolicyChoice): Pick<GuardConfig, "policy" | "variants"> | null {
  const variants = choice.variants.filter((name, i) => name !== choice.policy && choice.variants.indexOf(name) === i);
  if (choice.policy === "default" && variants.length === 0) return null;
  return { policy: choice.policy, variants };
}

export function policyByName(catalog: readonly GuardPolicyInfo[] | null, name: string): GuardPolicyInfo | null {
  return catalog?.find((entry) => entry.name === name) ?? null;
}

export function policySourceLabel(source: string | null | undefined): string {
  if (source === "file") return "policy file";
  if (source === "singguard") return "SingGuard's own rules";
  if (source === "builtin") return "built in";
  return source ?? "unknown";
}

/** `GET /guard/policies`, read defensively: an entry without a name is dropped. */
export function readPolicyCatalog(payload: unknown): GuardPolicyInfo[] {
  const list = (payload as { policies?: unknown } | null)?.policies;
  if (!Array.isArray(list)) return [];
  return list.filter((entry): entry is GuardPolicyInfo => typeof (entry as GuardPolicyInfo | null)?.name === "string");
}
