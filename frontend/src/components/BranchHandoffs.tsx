import Link from "next/link";
import { ExternalLink } from "@/components/ExternalLink";
import { assayUrl, maskUrl, puppetUiUrl } from "@/lib/curatorEnv";
import { branchesFrom, stageFor } from "@/lib/pipeline";
import { STAGE_TONE } from "@/components/StageHandoff";

const PILL = "inline-block rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors";

/**
 * "From here": the branches a stage leads to besides the next number (#236),
 * from `BRANCHES` in lib/pipeline.ts. A stage branch is a Studio page; an
 * external one is a standalone UI (Mask, Assay, Puppet), shown only when the deployment
 * configures its URL. Renders nothing for a stage with no branches.
 */
export function BranchHandoffs({ from, className = "" }: { from: string; className?: string }) {
  const branches = branchesFrom(from, { mask: maskUrl(), assay: assayUrl(), puppet: puppetUiUrl() });
  if (branches.length === 0) return null;
  const name = stageFor(from)?.label ?? "here";
  return (
    <nav aria-label={`From ${name}`} className={`flex flex-wrap items-start gap-x-3 gap-y-2 text-xs text-muted ${className}`}>
      <span className="py-1.5">From here:</span>
      <ul className="flex flex-wrap gap-2">
        {branches.map((branch) => (
          <li key={branch.href}>
            {branch.external ? (
              <ExternalLink href={branch.href} className={`${PILL} ${STAGE_TONE[branch.tone]}`}>
                {branch.label} <span className="font-normal opacity-80">({branch.external.service})</span> ↗
              </ExternalLink>
            ) : (
              <Link href={branch.href} prefetch={false} className={`${PILL} ${STAGE_TONE[branch.tone]}`}>
                {branch.label} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
