"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { getConcept } from "@/content/concepts";
import { Markdown } from "@/components/Markdown";

interface ParamInfoProps {
  /**
   * Pull label/description/example from the shared content registry. When set,
   * it supersedes the inline props below and enables a "Learn more" doc link.
   */
  conceptId?: string;
  /** Fallbacks / overrides used when `conceptId` is not supplied. */
  label?: string;
  description?: string;
  example?: string;
  children: ReactNode;
}

export function ParamInfo({
  conceptId,
  label,
  description,
  example,
  children,
}: ParamInfoProps) {
  const [expanded, setExpanded] = useState(false);
  const concept = conceptId ? getConcept(conceptId) : undefined;

  if (process.env.NODE_ENV !== "production" && conceptId && !concept && !label) {
    // A typo'd/unknown conceptId with no inline fallback renders a blank panel;
    // surface it during development instead of shipping an empty control.
    console.warn(`ParamInfo: unknown conceptId "${conceptId}" and no fallback label/description.`);
  }

  const resolvedLabel = concept?.title ?? label ?? "";
  const resolvedBody = concept?.body ?? description ?? "";
  const resolvedExample = concept?.example ?? example;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{resolvedLabel}</label>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-muted hover:text-accent-purple transition-colors cursor-pointer"
          aria-label={`${expanded ? "Hide" : "Show"} info for ${resolvedLabel}`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {expanded ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
              />
            )}
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-2">{children}</div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
          {resolvedBody && <Markdown>{resolvedBody}</Markdown>}
          {resolvedExample && (
            <code className="block text-xs text-accent-teal/80 bg-background rounded px-2 py-1 font-mono">
              {resolvedExample}
            </code>
          )}
          {concept?.href && (
            <Link
              href={concept.href}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent-purple hover:text-accent-purple/80 transition-colors"
            >
              Learn more
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
