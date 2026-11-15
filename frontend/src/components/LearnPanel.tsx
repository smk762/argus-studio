"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { getConcept } from "@/content/concepts";
import { Markdown } from "@/components/Markdown";

/**
 * The in-tool "Learn" panel (#39): an ⓘ beside a control opens a side sheet
 * with that concept's entry from the shared registry (content/concepts.ts),
 * the same text its /docs page renders, without leaving the tool.
 *
 * A non-modal <dialog> opened with show() (Modern Web Guidance `dialog`, rule 2:
 * the user keeps working in the page while it is open), fixed to the right
 * edge. It has a visible Close button and closes on Escape; focus moves into it
 * on open and back to the ⓘ that opened it on close. One panel per page:
 * opening another concept, or a related one, swaps the content in place.
 */

interface LearnApi {
  open: (conceptId: string, invoker: HTMLElement | null) => void;
}

const LearnContext = createContext<LearnApi | null>(null);

export function LearnProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const invokerRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [conceptId, setConceptId] = useState<string | null>(null);
  const titleId = useId();

  const open = useCallback((id: string, invoker: HTMLElement | null) => {
    invokerRef.current = invoker;
    setConceptId(id);
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  // Show once there is content; move focus to the title so a screen reader
  // starts at the top. Runs again when a related concept swaps the content.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !conceptId) return;
    if (!dialog.open) dialog.show();
    headingRef.current?.focus();
  }, [conceptId]);

  const onClose = () => {
    setConceptId(null);
    invokerRef.current?.focus();
    invokerRef.current = null;
  };

  const concept = conceptId ? getConcept(conceptId) : undefined;

  return (
    <LearnContext.Provider value={{ open }}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={onClose}
        onKeyDown={(event) => {
          // A non-modal dialog gets no Escape handling from the browser.
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
        className="fixed inset-y-0 right-0 left-auto z-50 m-0 h-dvh max-h-dvh w-[min(26rem,100vw)] overflow-y-auto overscroll-contain border-l border-border bg-surface p-0 text-foreground shadow-soft"
      >
        {concept ? (
          <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Learn</div>
                <h2 id={titleId} ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-foreground focus:outline-none">
                  {concept.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:bg-surface-hover hover:text-foreground"
              >
                Close
              </button>
            </div>
            <p className="text-sm text-foreground/80">{concept.summary}</p>
            <Markdown>{concept.body}</Markdown>
            {concept.example ? (
              <code className="block rounded-md bg-surface-hover px-2.5 py-1.5 font-mono text-xs text-accent-teal-ink">{concept.example}</code>
            ) : null}
            {concept.related?.length ? (
              <div className="border-t border-border pt-3">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Related</div>
                <ul className="flex flex-wrap gap-1.5">
                  {concept.related.map((id) => {
                    const related = getConcept(id);
                    return related ? (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => setConceptId(id)}
                          className="cursor-pointer rounded-md border border-border px-2 py-0.5 text-xs text-foreground/85 hover:bg-surface-hover"
                        >
                          {related.title}
                        </button>
                      </li>
                    ) : null;
                  })}
                </ul>
              </div>
            ) : null}
            {concept.href ? (
              <Link href={concept.href} className="inline-block text-sm text-accent-purple-ink underline underline-offset-2 hover:no-underline">
                Read the full page →
              </Link>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </LearnContext.Provider>
  );
}

/**
 * An ⓘ that opens a concept in the Learn panel. Outside a LearnProvider (or for
 * an id the registry lacks) it renders nothing rather than a dead button.
 */
export function LearnButton({ conceptId, className = "" }: { conceptId: string; className?: string }) {
  const api = useContext(LearnContext);
  const concept = getConcept(conceptId);
  if (!api || !concept) return null;
  return (
    <button
      type="button"
      onClick={(event) => api.open(conceptId, event.currentTarget)}
      aria-label={`Learn about ${concept.title}`}
      aria-haspopup="dialog"
      className={`inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center text-muted transition-colors hover:text-accent-purple-ink ${className}`}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
        />
      </svg>
    </button>
  );
}
