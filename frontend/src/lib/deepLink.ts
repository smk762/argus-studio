"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Apply upstream-stage deep-link params (`?folder=`, `?export=`, `?category=`,
 * `?trigger=`, …) that one pipeline stage hands to the next (#67).
 *
 * The single home for reading those params, so the three landing pages (caption,
 * curate, forge) no longer each hand-roll `new URLSearchParams(window.location
 * .search)` in a mount effect. Backed by `useSearchParams`, so unlike a raw
 * `window.location` read in a `[]`-effect it also re-applies when the query
 * changes on a client-side navigation (React reuses the page instance and a
 * `[]`-effect would never fire again).
 *
 * `apply` should read only from the params it is handed and call stable setters;
 * it is intentionally excluded from the effect deps (it is a fresh closure each
 * render) so the effect keys off the params alone.
 */
export function useDeepLink(apply: (params: URLSearchParams) => void): void {
  const search = useSearchParams();
  useEffect(() => {
    apply(new URLSearchParams(search.toString()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
}
