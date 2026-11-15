/**
 * The Trusted Types `default` policy for the server build's report-only dry
 * run (#198). The only sinks the app hits are the framework loading its own
 * chunks: Turbopack's runtime sets `script.src`, and React sets a script's
 * `src` attribute, both to same-origin `/_next/static/chunks/*.js`. Neither
 * goes through a policy, and the `default` policy is what the browser consults
 * for a raw string in that case.
 *
 * It accepts exactly those URLs and returns null for anything else, so it is a
 * gate, not a pass-through. Null rather than a throw: the browser then treats
 * the value as unhandled, which under the report-only policy is reported and
 * let through (the dry run never breaks the page) and under an enforced one is
 * blocked. It defines no `createHTML` or `createScript`: an HTML or script-text
 * sink still reports, which is what the dry run is for.
 */

/**
 * `input` as a script URL if it is one of this origin's Next chunks, else null.
 * Self-contained (no outer references): the layout inlines it via `toString()`.
 */
export function ownChunkScriptUrl(input: string, base: string): string | null {
  let url: URL;
  try {
    url = new URL(input, base);
  } catch {
    return null;
  }
  if (url.origin !== new URL(base).origin) return null;
  return /^\/_next\/static\/chunks\/[\w.-]+\.js$/.test(url.pathname) ? url.href : null;
}

/** The inline script that registers the `default` policy, once, where Trusted Types exists. */
export function trustedTypesPolicyScript(): string {
  return (
    `(function(){var tt=window.trustedTypes;if(!tt||!tt.createPolicy||tt.defaultPolicy)return;` +
    `var own=${ownChunkScriptUrl.toString()};` +
    `tt.createPolicy("default",{createScriptURL:function(s){return own(s,location.href)}});})();`
  );
}
