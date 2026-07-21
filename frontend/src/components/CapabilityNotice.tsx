import type { ReactNode } from "react";

/**
 * Explains why a control is inert, or why an action won't do what it appears to
 * (argus-studio#66).
 *
 * Deliberately paired with a control that stays **visible and disabled** rather
 * than being removed. Hiding it makes the deployment look less capable than it
 * is — a visitor to the public demo should see that evaluation runs exist and
 * learn that this host won't do them, not conclude the feature is missing.
 * Leaving it live and letting the request 403 makes it look broken.
 *
 * `reason` is a `ReactNode` so a caller can mark up an env var or a path inline.
 * This component is the single owner of the notice styling, which was otherwise
 * copy-pasted at every site that needed it.
 */
export function CapabilityNotice({ reason }: { reason: ReactNode }) {
  return (
    <p
      role="note"
      className="rounded-lg border border-accent-orange/30 bg-accent-orange/5 px-3 py-2 text-[11px] leading-relaxed text-accent-orange"
    >
      {reason}
    </p>
  );
}
