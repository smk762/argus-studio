import type { ReactNode } from "react";

/**
 * The API/version pill shown at the right edge of {@link SiteHeader}. Every tool
 * renders the same three states from a `version` value:
 *   - `null`  → still loading
 *   - `""`    → server unreachable (red)
 *   - else    → the resolved version, labelled with the service name
 *
 * `prefix` is prepended to the version (e.g. `"v"`); `children` renders above the
 * version block for a page's own extra pill (e.g. Curate's Live/Demo marker).
 * Page-specific sentinels that should replace the version entirely (e.g. Proof's
 * "demo") stay in the page — pass a real/`""`/`null` version here.
 */
export function ApiVersionBadge({
  label,
  version,
  prefix = "",
  className = "shrink-0 text-right",
  children,
}: {
  label: string;
  /** `null` = loading, `""` = unreachable, otherwise the version string. */
  version: string | null;
  prefix?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={className}>
      {children}
      {version === null ? (
        <span className="text-[10px] uppercase tracking-wider text-muted/60">…</span>
      ) : version === "" ? (
        <span className="text-[10px] uppercase tracking-wider text-accent-red/80">API unreachable</span>
      ) : (
        <div className="flex flex-col items-end gap-0.5" title={`${label} ${prefix}${version}`}>
          <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
          <span className="max-w-[14rem] truncate font-mono text-xs text-foreground/90 sm:max-w-xs">
            {prefix}
            {version}
          </span>
        </div>
      )}
    </div>
  );
}
