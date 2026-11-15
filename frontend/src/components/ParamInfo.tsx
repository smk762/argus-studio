"use client";

import { type ReactNode } from "react";
import { getConcept } from "@/content/concepts";
import { LearnButton } from "@/components/LearnPanel";

/**
 * A captioning control in a card, labelled from the shared concept registry,
 * with an ⓘ that opens the concept in the Learn panel (#39), the same text its
 * /docs page renders.
 */
export function ParamInfo({ conceptId, children }: { conceptId: string; children: ReactNode }) {
  const concept = getConcept(conceptId);
  if (process.env.NODE_ENV !== "production" && !concept) {
    console.warn(`ParamInfo: unknown conceptId "${conceptId}".`);
  }
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{concept?.title ?? conceptId}</span>
        <LearnButton conceptId={conceptId} />
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
