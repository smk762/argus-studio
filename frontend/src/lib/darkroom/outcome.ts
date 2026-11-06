import { minorExposedText } from "./age";
import { CONTEXT_LABEL, firedCell, reasonParts, uncheckedCell } from "./shields";
import type { GenerationRecord, Outcome } from "@/lib/darkroomApi";

export const OUTCOME_LABEL: Record<Outcome, string> = {
  passed: "Passed",
  review: "Review",
  deleted: "Deleted",
  omitted: "Omitted",
  refused: "Refused",
  failed: "Failed",
};

/** Token classes for an outcome badge. Each badge also carries its word, so colour is never the only signal. */
export const OUTCOME_TONE: Record<Outcome, string> = {
  passed: "text-accent-green border-accent-green/50",
  review: "text-accent-amber border-accent-amber/50",
  deleted: "text-accent-red border-accent-red/50",
  omitted: "text-foreground/70 border-border",
  refused: "text-accent-red border-accent-red/50",
  failed: "text-foreground/70 border-border",
};

export interface DeletedSummary {
  headline: string;
  lines: string[];
}

/** What a deleted tile says: every reason that applied, since a rule, the age rule and a failed check can land together. */
export function deletedSummary(record: GenerationRecord): DeletedSummary {
  const parts = reasonParts(record.outcome_reason);
  const lines: string[] = [];
  const fired = firedCell(record);
  if (fired?.cell.result) {
    const rule = fired.cell.result.rules[0] ?? "a rule";
    lines.push(`Rule ${rule} fired under ${fired.policy}, in the ${CONTEXT_LABEL[fired.context].toLowerCase()} scan.`);
  }
  if (parts.includes("minor-exposed")) lines.push(minorExposedText(record.guard.age));
  if (parts.includes("unchecked")) {
    const cell = uncheckedCell(record);
    const where = cell ? `${CONTEXT_LABEL[cell.context].toLowerCase()} scan under ${cell.policy}` : "a scan under the enforcing policy";
    const error = cell?.cell.error ? ` (${cell.cell.error})` : "";
    lines.push(`The ${where} did not complete${error}. Darkroom fails closed: an unchecked enforcing cell deletes the image.`);
  }
  if (lines.length === 0 && record.outcome_reason) lines.push(`Reason: ${record.outcome_reason}.`);
  return { headline: "This image was destroyed.", lines };
}

/** What an omitted tile says. It must not read like a deletion. */
export function omittedSummary(record: GenerationRecord): DeletedSummary {
  const score = record.guard.nudenet?.exposed_score;
  if (record.outcome_reason === "sfw-unchecked" || score == null) {
    return { headline: "SFW output withheld.", lines: ["NudeNet did not respond, so the image was not kept."] };
  }
  return { headline: "SFW output withheld.", lines: [`NudeNet reported exposure (score ${score.toFixed(2)}), so the image was not kept.`] };
}

export function hasImage(record: GenerationRecord): boolean {
  return (record.outcome === "passed" || record.outcome === "review") && record.removed_at == null;
}
