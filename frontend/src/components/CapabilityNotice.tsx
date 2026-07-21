/**
 * Explains why a control is inert (argus-studio#66).
 *
 * Deliberately paired with a control that stays **visible and disabled** rather
 * than being removed. Hiding it makes the deployment look less capable than it
 * is — a visitor to the public demo should see that evaluation runs exist and
 * learn that this host won't do them, not conclude the feature is missing.
 * Leaving it live and letting the request 403 makes it look broken.
 */
export function CapabilityNotice({ reason }: { reason: string }) {
  return (
    <p
      role="note"
      className="rounded-lg border border-accent-orange/30 bg-accent-orange/5 px-3 py-2 text-[11px] leading-relaxed text-accent-orange"
    >
      {reason}
    </p>
  );
}
