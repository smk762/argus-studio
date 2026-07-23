"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Apply upstream-stage deep-link params (`?folder=`, `?export=`, `?category=`,
 * `?trigger=`, …) that one pipeline stage hands to the next (#67).
 *
 * The single home for reading those params, so the three landing pages (caption,
 * curate, forge) no longer each hand-roll `new URLSearchParams(window.location
 * .search)` in a mount effect.
 *
 * Applied exactly once, on first mount — the params are a one-shot prefill, not
 * a live binding. It deliberately does NOT re-apply when the query later changes
 * on a client-side navigation: the destination fields are user-editable, so
 * re-asserting a URL value over an in-progress edit — e.g. after a browser
 * back/forward that returns to the deep-linked query — would silently discard
 * the edit. The `applied` ref latches the first run; `useSearchParams` (rather
 * than a raw `window.location` read) is kept only so the value is read through
 * the router rather than off `window` during render.
 *
 * `apply` should read only from the params it is handed and call stable setters.
 */
export function useDeepLink(apply: (params: URLSearchParams) => void): void {
  const search = useSearchParams();
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    apply(new URLSearchParams(search.toString()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
}
