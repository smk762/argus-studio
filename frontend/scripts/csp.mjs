// Post-build (static demo only): give every exported page a strict, hash-based
// Content-Security-Policy.
//
// `npm run build:static` (output: "export") emits Next's bootstrap and the theme
// boot script as inline <script>s, and there is no server to mint nonces, so each
// page gets a <meta http-equiv> CSP listing the sha256 of exactly the inline
// scripts it shipped with. Hashing at build time is safe because the exported
// HTML holds no user content: the demo's data arrives later from public/demo/
// and renders through React. The same goes for the few inline <style> elements
// (Next's built-in 404). Server-rendered `style` attributes (progress widths and
// the like) are allowed with style-src-attr; they cannot run script.
//
// No Trusted Types (require-trusted-types-for), unlike argus-lightbox: Next's own
// runtime here assigns plain strings to sinks (the <Script> loader sets
// script.src, a framework chunk writes innerHTML), and only a pass-through
// policy would let them through, which protects nothing.
//
// Directives a <meta> CSP can't carry (frame-ancestors) and the companion
// headers go in out/_headers, which Cloudflare Pages reads.
//
// The normal `npm run build` (standalone server) does not run this: its config
// script differs per deployment (argus-studio#56), so it can't be hashed here.
//
//   node scripts/csp.mjs [outDir]   (run by `npm run build:static`)
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const INLINE_SCRIPT = /<script\b(?![^>]*\ssrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
const INLINE_STYLE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

/** @param {string} body */
function sha256(body) {
  return `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`;
}

/** @param {string} html @param {RegExp} re @returns {string[]} hash sources for each non-empty match. */
function hashes(html, re) {
  const out = new Set();
  for (const [, body] of html.matchAll(re)) if (body) out.add(sha256(body));
  return [...out];
}

/** @param {string} html @returns {string[]} CSP hash sources for each non-empty inline script. */
export const inlineScriptHashes = (html) => hashes(html, INLINE_SCRIPT);

/** @param {string} html @returns {string[]} CSP hash sources for each non-empty inline <style>. */
export const inlineStyleHashes = (html) => hashes(html, INLINE_STYLE);

/** @param {string[]} scripts @param {string[]} styles */
export function policy(scripts, styles = []) {
  return [
    "default-src 'self'",
    `script-src 'self' ${scripts.join(" ")}`.trim(),
    "style-src 'self'",
    `style-src-elem 'self' ${styles.join(" ")}`.trim(),
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

/**
 * @param {string} html
 * @returns {string} html with the CSP <meta> ahead of any script: right after <meta charset>
 *   (which has to stay within the first 1024 bytes), else first in <head>.
 */
export function withCsp(html) {
  if (html.includes('http-equiv="Content-Security-Policy"')) throw new Error("page already has a CSP <meta>");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy(inlineScriptHashes(html), inlineStyleHashes(html))}"/>`;
  const anchor = /<meta charset=[^>]*>/i.exec(html) ?? /<head[^>]*>/i.exec(html);
  if (!anchor) throw new Error("no <head> to put the CSP in");
  const end = anchor.index + anchor[0].length;
  return html.slice(0, end) + meta + html.slice(end);
}

// Response headers for hosts that read a _headers file. frame-ancestors only works as a header.
// No outbound popups depend on window.opener (external links are rel="noopener"), so COOP is same-origin.
export const HEADERS = `/*
  Content-Security-Policy: frame-ancestors 'none'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), geolocation=(), microphone=()
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000
`;

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith(".html"))
    .map((e) => join(e.parentPath, e.name));
}

// pathToFileURL, not a `file://` template: import.meta.url is percent-encoded, so a
// checkout path with a space would otherwise skip this block and ship no CSP at all.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2] ?? "out";
  const files = htmlFiles(out);
  for (const file of files) writeFileSync(file, withCsp(readFileSync(file, "utf8")));
  writeFileSync(join(out, "_headers"), HEADERS);
  console.log(`csp: ${files.length} page(s)`);
}
