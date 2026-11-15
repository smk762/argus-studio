"use client";

import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";

const HALF_WIDTH = 136;
/** How long the bubble outlives the pointer leaving the trigger: time to cross the 6px gap onto it. */
const HIDE_DELAY_MS = 150;

/**
 * A tooltip for whatever it wraps, on hover or keyboard focus, ported from
 * argus-cull. It renders into the page body at a fixed position, so a scrolling
 * panel does not clip it, and it keeps inside the viewport's sides. Above the
 * target unless that would leave the top of the screen. Escape dismisses it.
 * Inside an open modal `<dialog>` it renders into the dialog instead: the body
 * sits under the top layer and is inert there. Escape then closes the tooltip
 * first and the dialog on a second press.
 *
 * WCAG 1.4.13 (content on hover or focus): the bubble is hoverable, so a pointer
 * (or a magnifier following it) can move onto it without it closing; it stays
 * while the pointer is on the trigger or the bubble, or focus is on the
 * trigger; and Escape dismisses it without moving either.
 *
 * The hover lands on the wrapper, so it also works around a disabled button,
 * which is where a native `title` tends to go unseen. By default `text` is visual
 * only: give the control its own `aria-label`. With `describe`, the text also
 * becomes the wrapped element's accessible description (a hidden copy it points
 * `aria-describedby` at), for a hint that says more than the control's name,
 * such as why it is disabled. Don't use it when the text repeats the name.
 */
export function Tooltip({
  text,
  children,
  className = "",
  describe = false,
}: {
  text: string;
  children: ReactNode;
  className?: string;
  describe?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const descId = `${id}-desc`;
  const described =
    describe && text && isValidElement<{ "aria-describedby"?: string }>(children)
      ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
          // Add to a description the control already has, never replace it.
          "aria-describedby": [children.props["aria-describedby"], descId].filter(Boolean).join(" "),
        })
      : children;
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean; host: Element } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }

  function hideSoon() {
    cancelHide();
    hideTimer.current = setTimeout(() => setPos(null), HIDE_DELAY_MS);
  }

  function hideNow() {
    cancelHide();
    setPos(null);
  }

  useEffect(() => cancelHide, []);

  function show() {
    cancelHide();
    if (!text) return; // nothing to say: no empty bubble

    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const below = rect.top < 120;
    const x = Math.min(Math.max(rect.left + rect.width / 2, HALF_WIDTH), window.innerWidth - HALF_WIDTH);
    const host = ref.current?.closest("dialog[open]") ?? document.body;
    setPos({ x, y: below ? rect.bottom + 6 : rect.top - 6, below, host });
  }

  return (
    <span
      ref={ref}
      className={`inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onFocus={show}
      onBlur={hideNow}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !pos) return;
        // Cancelling the keydown stops a surrounding modal <dialog> treating
        // the same press as its close request.
        event.preventDefault();
        hideNow();
      }}
    >
      {described}
      {described !== children && (
        <span id={descId} hidden>
          {text}
        </span>
      )}
      {pos
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              // Hoverable (WCAG 1.4.13): the pointer may rest on the bubble to read it.
              onMouseEnter={cancelHide}
              onMouseLeave={hideSoon}
              className="fixed z-50 w-max max-w-64 rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-normal text-foreground/80 shadow-soft"
              style={{ left: pos.x, top: pos.y, transform: `translate(-50%, ${pos.below ? "0" : "-100%"})` }}
            >
              {text}
            </span>,
            pos.host,
          )
        : null}
    </span>
  );
}

/** A small "i" beside a label that explains it. Focusable, and a click does not reach the label it sits in. */
export function Info({ text }: { text: string }) {
  return (
    <Tooltip text={text} className="shrink-0 align-middle">
      <span
        role="img"
        tabIndex={0}
        aria-label={text}
        className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-muted text-[9px] leading-none font-semibold text-muted hover:border-foreground hover:text-foreground focus-visible:outline focus-visible:outline-accent-purple"
        onClick={(event) => event.preventDefault()}
      >
        i
      </span>
    </Tooltip>
  );
}
