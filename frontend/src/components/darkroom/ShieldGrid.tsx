"use client";

import { CONTEXT_LABEL, policyRows, promptTurned, rowDisagrees, type PolicyRow } from "@/lib/darkroom/shields";
import type { Cell, GuardBlock, ScanContext } from "@/lib/darkroomApi";

import { ShieldCell } from "./ShieldCell";
import { Badge } from "./ui";

export type GridGuard = Pick<GuardBlock, "enforcing_policy" | "advisory_policies" | "scans">;

/**
 * Policies down, the two scan contexts across. The enforcing policy is first
 * and labelled. A ≠ badge marks a row whose cells disagree, and a dashed
 * outline marks a with-prompt cell where the prompt alone turned a green.
 */
export function ShieldGrid({ guard, rows: given }: { guard: GridGuard; rows?: PolicyRow[] }) {
  const rows = given ?? policyRows(guard);
  const contexts: ScanContext[] = ["isolated", "with_prompt"];
  return (
      <table className="w-full border-separate border-spacing-y-1 text-sm">
      <thead>
        <tr className="text-xs uppercase tracking-wide text-muted">
          <th scope="col" className="pb-1 text-left font-medium">
            Policy
          </th>
          {contexts.map((context) => (
            <th key={context} scope="col" className="pb-1 text-center font-medium">
              {CONTEXT_LABEL[context]}
            </th>
          ))}
          <th scope="col" className="pb-1">
            <span className="sr-only">Agreement</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.policy} className="align-middle">
            <th scope="row" className="pr-3 text-left font-normal">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-mono text-sm text-foreground [overflow-wrap:anywhere]">{row.policy}</span>
                {row.enforcing ? (
                  <Badge className="border-accent-purple/60 text-accent-teal" title="Its verdict decides pre-flight and sets the mode">
                    enforcing
                  </Badge>
                ) : (
                  <span className="text-xs text-muted">advisory</span>
                )}
              </span>
            </th>
            {contexts.map((context) => (
              <td key={context} className="text-center">
                <ShieldCell cell={row.pair?.[context] ?? null} heading={`${row.policy} · ${CONTEXT_LABEL[context]}`} outlined={context === "with_prompt" && promptTurned(row.pair)} />
              </td>
            ))}
            <td className="w-8 text-center">
              {rowDisagrees(row.pair) ? (
                <span title="The isolated and with-prompt scans disagree" aria-label="scans disagree" className="inline-block rounded-sm border border-accent-amber/60 px-1 text-xs font-bold text-accent-amber">
                  ≠
                </span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
      </table>
  );
}

/** The pre-flight panel's column: one shield per policy, the text-only verdict. */
export function PreflightColumn({ results, enforcing }: { results: Record<string, Cell>; enforcing: string }) {
  const names = [enforcing, ...Object.keys(results).filter((name) => name !== enforcing)].filter((name) => name in results);
  return (
    <ul className="space-y-1">
      {names.map((name) => (
        <li key={name} className="flex items-center gap-3">
          <ShieldCell cell={results[name]} heading={`${name} · pre-flight`} size="h-8 w-8" labelBelow={false} />
          <span className="font-mono text-sm text-foreground">{name}</span>
          {name === enforcing ? (
            <Badge className="border-accent-purple/60 text-accent-teal">enforcing</Badge>
          ) : (
            <span className="text-xs text-muted">advisory</span>
          )}
        </li>
      ))}
    </ul>
  );
}
