import type { AnchorHTMLAttributes } from "react";

/**
 * The one way the studio links off-site (GitHub, Wikimedia, Immich, dragonhound.dev and the
 * sibling demo sites): a new tab with no window.opener or Referer, and a screen-reader cue
 * saying so. Same-site routes stay next/link.
 */
export function ExternalLink({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  );
}
