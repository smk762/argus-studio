import Link from "next/link";
import { stageFor, type StageTone } from "@/lib/pipeline";

/** Per-stage accent, so a hand-off is coloured like the page it leads to. */
const TONE: Record<StageTone, string> = {
  purple: "border-accent-purple/40 bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20",
  amber: "border-accent-amber/40 bg-accent-amber/10 text-accent-amber hover:bg-accent-amber/20",
  green: "border-accent-green/40 bg-accent-green/10 text-accent-green hover:bg-accent-green/20",
  teal: "border-accent-teal/40 bg-accent-teal/10 text-accent-teal hover:bg-accent-teal/20",
};

/**
 * The "next stage" affordance at the end of a stage's happy path (#67).
 *
 * The suite is a pipeline — gallery, curate, caption, forge, proof — and every
 * hand-off renders through this one component so the sequence reads the same
 * wherever a visitor picks it up. Tone and label default to the destination
 * stage's identity (resolved from `href` via the PIPELINE definition), so a
 * hand-off names only *where it goes* and the "amber / Configure training in
 * Forge" pairing lives in one place instead of at each call site. Either can be
 * overridden; the context a stage carries forward (an export path, a trigger
 * word) still lives in the caller's `href`.
 *
 * If `href` resolves to no pipeline stage (an off-pipeline or sub-route target),
 * the hand-off falls back to a neutral accent and a generic label and warns in
 * dev — it never throws, so one mistyped href can't crash the whole route. Pass
 * `tone`/`label` explicitly to hand off to a destination outside the pipeline.
 *
 * `disabled` keeps the link on screen but inert, for the window where the next
 * stage exists but leaving would break this one: the curator's export panel
 * shows its hand-off while captioning is still streaming, and a client-side
 * navigation there aborts the stream.
 *
 * `className` overrides the default `inline-block` layout for a caller that
 * needs a different shape (e.g. a full-width button in a gallery card).
 */
export function StageHandoff({
  href,
  label,
  tone,
  disabled = false,
  disabledLabel,
  className,
}: {
  href: string;
  /** Defaults to the destination stage's hand-off call-to-action. */
  label?: string;
  /** Defaults to the destination stage's accent. */
  tone?: StageTone;
  disabled?: boolean;
  disabledLabel?: string;
  /** Replaces the default `inline-block` layout classes. */
  className?: string;
}) {
  const dest = stageFor(href);
  if (process.env.NODE_ENV !== "production" && !dest && (tone == null || label == null)) {
    console.warn(
      `StageHandoff: no pipeline stage owns "${href}". Falling back to a default ` +
        "accent/label; pass `tone` and `label` explicitly for an off-pipeline destination.",
    );
  }
  const resolvedTone = tone ?? dest?.tone ?? "purple";
  const resolvedLabel = label ?? dest?.handoff ?? dest?.label ?? "Continue";
  return (
    <Link
      href={href}
      // These are end-of-stage affordances most visitors never take, and a
      // disabled one guards an in-flight stream — so don't let Next prefetch the
      // destination's RSC payload on viewport entry (it ignores the disabled
      // state and would contend with that stream).
      prefetch={false}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      // pointer-events-none blocks the mouse; this catches keyboard/programmatic
      // activation of a still-focusable but inert link.
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${TONE[resolvedTone]} ${
        disabled ? "pointer-events-none opacity-40" : ""
      } ${className ?? "inline-block"}`}
    >
      {disabled ? (disabledLabel ?? resolvedLabel) : `${resolvedLabel} →`}
    </Link>
  );
}
