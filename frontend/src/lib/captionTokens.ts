/**
 * Token use for a finished caption. This is lens's own rough estimate
 * (`argus_lens.assembly.token_budget`), not a tokenizer: words times a factor,
 * plus punctuation. It is the whole-text form lens applies to a finished caption
 * in its refine check and its eval. Assembly sums per fragment instead and comes
 * out lower, so a tag-heavy variant lens packed to fit can still read as over.
 */

import { TARGET_BACKENDS, type CaptionResult } from "@/types";

/** `/profiles` gives budgets but not encoders, so this mirrors lens's `T5_BACKENDS`. */
const T5_BACKENDS = new Set(["flux", "sd3", "kolors", "pixart"]);

/** Lens's `DEFAULT_TOKEN_BUDGET`, for a backend it has no entry for. */
const DEFAULT_TOKEN_BUDGET = 60;

export interface TokenUse {
  used: number;
  budget: number;
  over: boolean;
}

const backendName = (backend: string) => backend.toLowerCase().trim();

const countOf = (text: string, marks: RegExp) => text.match(marks)?.length ?? 0;

export const isT5Backend = (backend: string) => T5_BACKENDS.has(backendName(backend));

export function estimateTokens(text: string, backend: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return isT5Backend(backend)
    ? Math.trunc(words * 1.1) + countOf(text, /,/g)
    : Math.trunc(words * 1.3) + countOf(text, /[,_]/g);
}

/** `token_budgets` from `GET /profiles`: older lens builds omit it, and only sane numbers count. */
export function tokenBudgetsOf(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).flatMap(([backend, budget]) =>
      typeof budget === "number" && Number.isFinite(budget) && budget > 0 ? [[backendName(backend), budget]] : [],
    ),
  );
}

/** Lens's figure when it gave one, then the built-in table, then lens's default. */
export function tokenBudget(backend: string, budgets: Record<string, number> = {}): number {
  const name = backendName(backend);
  return budgets[name] ?? TARGET_BACKENDS.find((b) => b.value === name)?.tokens ?? DEFAULT_TOKEN_BUDGET;
}

export function tokenUse(text: string, backend: string, budgets?: Record<string, number>): TokenUse {
  const used = estimateTokens(text, backend);
  const budget = tokenBudget(backend, budgets);
  return { used, budget, over: used > budget };
}

/**
 * The backend a result was sized for. Lens does not echo `target_backend`, so
 * this is the one the page sent, unless the result is a replay: that was
 * assembled for its recorded profile, whatever this request asked for.
 */
export function sizedForBackend(result: CaptionResult, requested: string): string {
  const replay = result.metadata?.replay;
  if (!replay || typeof replay !== "object") return requested;
  const profile = (replay as Record<string, unknown>).recorded_profile;
  if (!profile || typeof profile !== "object") return requested;
  const recorded = (profile as Record<string, unknown>).target_backend;
  return typeof recorded === "string" && recorded.trim() ? recorded : requested;
}
