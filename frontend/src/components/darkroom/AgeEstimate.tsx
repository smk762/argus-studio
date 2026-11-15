import { AGE_HOVER, ageEstimateLines, toolName } from "@/lib/darkroom/age";
import type { AgeBlock } from "@/lib/darkroomApi";
import { Tooltip } from "@/components/Tooltip";

/**
 * One line per face, always with the tool's name, never under a label that
 * says "Age". The tooltip (also each line's description, so it reaches screen
 * readers and keyboard users) says it is an automated guess and can be wrong.
 */
export function AgeEstimate({ age }: { age: AgeBlock | null }) {
  if (!age) return <p className="text-sm text-muted">No age check on this record.</p>;
  const lines = ageEstimateLines(age);
  if (lines.length === 0) return <p className="text-sm text-muted">{toolName(age.source)} found no face to estimate from.</p>;
  return (
    <ul className="space-y-0.5 text-sm">
      {lines.map((line, index) => (
        <li key={index}>
          <Tooltip text={AGE_HOVER} describe>
            <span tabIndex={0} className="cursor-help text-foreground underline decoration-dotted decoration-border underline-offset-4">
              {line}
            </span>
          </Tooltip>
        </li>
      ))}
      {age.minor_exposed ? <li className="text-xs text-accent-red-ink">An estimate under 18 coincided with NudeNet exposure (the minor-exposed rule).</li> : null}
    </ul>
  );
}
