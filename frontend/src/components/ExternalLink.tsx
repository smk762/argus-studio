import type { AnchorHTMLAttributes } from "react";

import { isFamilyHref } from "@/lib/familyHost";

/**
 * The one way the studio links off-site. A Dragonhound Labs host (dragonhound.dev
 * and *.dragonhound.dev: the landing page and the sibling demos) is family and
 * opens in the same tab, so Back works. Anything else (GitHub, Wikimedia, Immich…)
 * opens a new tab with no window.opener or Referer, and a screen-reader cue saying
 * so. Same-site routes stay next/link.
 */
export function ExternalLink({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (isFamilyHref(props.href)) return <a {...props}>{children}</a>;
  return (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  );
}
