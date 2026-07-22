import Link from "next/link";

/** Per-stage accent, so a hand-off is coloured like the page it leads to. */
const TONE = {
  purple: "border-accent-purple/40 bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20",
  amber: "border-accent-amber/40 bg-accent-amber/10 text-accent-amber hover:bg-accent-amber/20",
  green: "border-accent-green/40 bg-accent-green/10 text-accent-green hover:bg-accent-green/20",
} as const;

export type HandoffTone = keyof typeof TONE;

/**
 * The "next stage" affordance at the end of a stage's happy path (#67).
 *
 * The suite is a pipeline — gallery, curate, caption, forge, proof — and before
 * this the only link between any two stages was gallery -> curate. Every
 * hand-off renders through this one component so the sequence reads the same
 * wherever a visitor picks it up, and so the context each stage carries forward
 * (an export path, a trigger word) lives in the caller's `href` rather than in
 * five hand-rolled links.
 *
 * `disabled` keeps the link on screen but inert, for the window where the next
 * stage exists but leaving would break this one: the curator's export panel
 * shows its hand-off while captioning is still streaming, and a client-side
 * navigation there aborts the stream.
 */
export function StageHandoff({
  href,
  label,
  tone,
  disabled = false,
  disabledLabel,
}: {
  href: string;
  label: string;
  tone: HandoffTone;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      className={`inline-block rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        TONE[tone]
      } ${disabled ? "pointer-events-none opacity-40" : ""}`}
    >
      {disabled ? (disabledLabel ?? label) : `${label} →`}
    </Link>
  );
}
