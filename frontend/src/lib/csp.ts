/**
 * Content-Security-Policy for every page, set per request by `src/proxy.ts`
 * (Modern Web Guidance `security`, §3.2; Next's content-security-policy guide).
 *
 * The policy is about scripts: a fresh nonce per request with 'strict-dynamic',
 * so only the scripts Next renders (its own bundles, which it nonces from the
 * request's CSP header, and the layout's two inline scripts, which read
 * `x-nonce`) run, and whatever they load. It does not set default-src,
 * connect-src or img-src: the browser calls up to seven backends cross-origin
 * at URLs only known at runtime, and an allow-list here would have to track
 * them. Trusted Types (require-trusted-types-for) is not on yet.
 */

/** `ARGUS_CSP`: enforce (default), report-only (logs violations to the console), or off. */
export type CspMode = "enforce" | "report-only" | "off";

export const CSP_ENV = "ARGUS_CSP";

/** Read `ARGUS_CSP`. Unset or unrecognised means enforce: the safe side. */
export function cspMode(raw: string | undefined): CspMode {
  const value = raw?.trim().toLowerCase();
  if (value === "report-only") return "report-only";
  if (value === "off" || value === "0" || value === "false") return "off";
  return "enforce";
}

/** Whether `cspMode` read `raw` as written, rather than defaulting a typo (`report_only`) to enforce. */
export function cspModeRecognised(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return !value || ["enforce", "report-only", "off", "0", "false"].includes(value);
}

/** A 128-bit nonce, base64, from the platform CSPRNG. */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * The policy string. `dev` adds 'unsafe-eval', which React's development build
 * needs for its error overlays and which production never uses.
 */
export function contentSecurityPolicy(nonce: string, { dev = false }: { dev?: boolean } = {}): string {
  return [
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'report-sample'${dev ? " 'unsafe-eval'" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
}

/** The CSP header's name for a mode, or null when the policy is off. */
export function cspHeaderName(mode: CspMode): string | null {
  if (mode === "off") return null;
  return mode === "report-only" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
}

/**
 * Low-risk companions sent whatever the mode: no framing (studio is never
 * embedded), no MIME sniffing, and the browsers' default referrer policy
 * stated outright.
 */
export const COMPANION_HEADERS: readonly (readonly [string, string])[] = [
  ["X-Frame-Options", "DENY"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
];
