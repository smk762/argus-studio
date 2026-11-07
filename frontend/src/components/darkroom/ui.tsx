import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "primary" | "neutral" | "danger";

const BUTTON_TONE: Record<Tone, string> = {
  primary: "bg-accent-purple text-white hover:bg-accent-purple/80 disabled:hover:bg-accent-purple",
  neutral: "bg-surface-hover text-foreground hover:bg-border disabled:hover:bg-surface-hover",
  danger: "bg-accent-red/15 text-accent-red border border-accent-red/40 hover:bg-accent-red/25 disabled:hover:bg-accent-red/15",
};

export function Button({ tone = "neutral", small = false, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; small?: boolean }) {
  const size = small ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";
  return <button type="button" {...props} className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${size} ${BUTTON_TONE[tone]} ${className}`} />;
}

export function Badge({ children, className = "", title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide ${className}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "", as: Tag = "section", "aria-labelledby": labelledBy }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "aside"; "aria-labelledby"?: string }) {
  return <Tag aria-labelledby={labelledBy} className={`rounded-lg border border-border/60 bg-surface p-4 ${className}`}>{children}</Tag>;
}

export function SectionTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-sm font-semibold uppercase tracking-wide text-foreground/70 ${className}`}>{children}</h2>;
}

export function Notice({ tone = "info", children, className = "" }: { tone?: "info" | "warning" | "error"; children: ReactNode; className?: string }) {
  const tones = { info: "border-accent-blue/40 text-foreground", warning: "border-accent-amber/50 text-foreground", error: "border-accent-red/50 text-foreground" };
  const word = { info: "Note", warning: "Warning", error: "Error" };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border bg-surface-hover/60 px-3 py-2 text-sm ${tones[tone]} ${className}`}>
      <span className={`mr-2 font-semibold ${tone === "warning" ? "text-accent-amber" : tone === "error" ? "text-accent-red" : "text-accent-blue"}`}>{word[tone]}:</span>
      {children}
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} animate-spin text-muted`} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Kv({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm" title={title}>
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-foreground">{children}</dd>
    </div>
  );
}
