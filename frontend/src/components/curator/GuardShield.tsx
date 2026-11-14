import type { PolicyShield } from "@/lib/curatorGuard";

const BODY = "M12 2 4 5.5V11c0 5.1 3.4 9.8 8 11 4.6-1.2 8-5.9 8-11V5.5L12 2Z";

const TONE: Record<PolicyShield["state"], string> = {
  pending: "text-muted",
  safe: "text-accent-green-ink",
  unsafe: "text-accent-red-ink",
};

/**
 * One policy's verdict. The mark inside says it without the colour.
 *
 * Deliberately not darkroom's Shield, whose flagged and illegal come from the
 * record. A curator verdict is only safe or unsafe, so drawing it there would
 * mean this page picking one of those for it.
 */
export function GuardShield({ shield, className = "h-3.5 w-3.5" }: { shield: PolicyShield; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={shield.title} className={`${className} shrink-0 ${TONE[shield.state]}`} fill="currentColor">
      <title>{shield.title}</title>
      <path d={BODY} opacity={shield.state === "pending" ? 0.45 : 1} />
      {shield.state === "safe" && <path d="m9 12 2 2 4-4" fill="none" className="stroke-background" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {shield.state === "unsafe" && <path d="m9 9 6 6M15 9l-6 6" fill="none" className="stroke-background" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}
