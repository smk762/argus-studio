#!/usr/bin/env node
// Regression guard for the static demo export: no route may scroll sideways
// on a phone. Serves `out/` (from `npm run build:static`) on a local port,
// opens every exported route at 390x844 in headless Chromium and fails if
// `document.documentElement.scrollWidth > innerWidth`. It also fails on
// console errors and CSP violations, which the static build's hash CSP
// (scripts/csp.mjs) turns into silent breakage otherwise.
//
// The shared theme script (public/dh-theme.js, a plain blocking <script src> in
// <head>) is checked on every route too: it must have run (a CSP that blocks it
// fails here, not just as a console line), the toggle must flip the scheme and
// its aria-pressed, and a saved `dh-theme` cookie must be on <html> before
// <body> is parsed, i.e. before the first paint (no flash of the wrong theme).
//
// Playwright is not a dependency of the app. CI installs it on the fly:
//   npm i --no-save playwright@1.65.0 && npx playwright install --with-deps chromium
// Locally, PLAYWRIGHT_MODULE=/path/to/node_modules/playwright and
// CHROME=/path/to/chrome point it at an existing install.
//
// Usage: node scripts/check-overflow.mjs [outDir] [--width=390]

import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const outDir = path.resolve(args.find((a) => !a.startsWith("--")) ?? "out");
const width = Number(args.find((a) => a.startsWith("--width="))?.split("=")[1] ?? 390);

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** Every exported page: each `index.html` under outDir, as a route path. */
async function routes(dir, prefix = "/") {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith("_")) continue; // _next, _not-found
      found.push(...(await routes(path.join(dir, entry.name), `${prefix}${entry.name}/`)));
    } else if (entry.name === "index.html") {
      found.push(prefix); // trailing slash, as the export (trailingSlash) and Pages serve it
    }
  }
  return found.sort();
}

async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const file = path.join(outDir, clean);
  if (!file.startsWith(outDir)) return null;
  for (const candidate of [file, path.join(file, "index.html"), `${file}.html`]) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // try the next form
    }
  }
  return null;
}

/** dh-theme.js ran, and its toggle flips the scheme and aria-pressed both ways. */
async function checkTheme(page, scheme) {
  const out = [];
  const state = () =>
    page.evaluate(() => ({
      api: typeof window.dhTheme === "object",
      dark:
        (document.documentElement.dataset.theme ||
          (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark",
      pressed: document.querySelector("[data-dh-theme-toggle]")?.getAttribute("aria-pressed") ?? null,
    }));
  const before = await state();
  if (!before.api) return ["theme: dh-theme.js did not run (blocked, or not in <head>?)"];
  if (before.dark !== (scheme === "dark")) out.push(`theme: ${scheme} system scheme rendered as ${before.dark ? "dark" : "light"}`);
  if (before.pressed !== String(before.dark)) out.push(`theme: toggle aria-pressed=${before.pressed} on a ${before.dark ? "dark" : "light"} page`);
  for (let i = 0; i < 2; i++) {
    const prev = await state();
    await page.locator("[data-dh-theme-toggle]").first().click();
    const next = await state();
    if (next.dark === prev.dark) out.push("theme: the toggle did not change the scheme");
    if (next.pressed !== String(next.dark)) out.push(`theme: aria-pressed=${next.pressed} after toggling to ${next.dark ? "dark" : "light"}`);
  }
  return out;
}

const server = createServer(async (req, res) => {
  const file = await resolveFile(req.url ?? "/");
  if (!file) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  res.end(await readFile(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

// /404/ is the not-found page, not a route; data folders (demo/, *-sample/) hold no index.html.
const pages = (await routes(outDir)).filter((r) => r !== "/404/");
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const failures = [];
try {
  for (const scheme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: scheme });
    for (const route of pages) {
      const page = await context.newPage();
      const problems = [];
      page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
      page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
      await page.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", (e) =>
          console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`),
        );
      });
      await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
      const { sw, iw } = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
      }));
      if (sw > iw) problems.push(`scrolls sideways: scrollWidth ${sw} > innerWidth ${iw}`);
      problems.push(...(await checkTheme(page, scheme)));
      console.log(`${problems.length ? "FAIL" : "ok  "} ${scheme.padEnd(5)} ${route} (${sw}/${iw})`);
      for (const p of problems) failures.push(`${scheme} ${route}: ${p}`);
      await page.close();
    }
    await context.close();
  }
  // A saved choice (the cookie dh-theme.js writes) must be on <html> before <body>
  // exists: that is what "no flash" means. Opposite of the system scheme, so a
  // pass can't come from the media query alone.
  for (const [scheme, saved] of [["light", "dark"], ["dark", "light"]]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: scheme });
    await context.addCookies([{ name: "dh-theme", value: saved, url: base }]);
    const page = await context.newPage();
    await page.addInitScript(() => {
      // Init scripts run before <html> exists, so watch the document itself.
      new MutationObserver((_, obs) => {
        if (!document.body) return;
        window.__themeAtBody = document.documentElement.dataset.theme ?? null;
        obs.disconnect();
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto(`${base}${pages[0]}`, { waitUntil: "load" });
    const atBody = await page.evaluate(() => window.__themeAtBody);
    const ok = atBody === saved;
    console.log(`${ok ? "ok  " : "FAIL"} cookie ${saved} on a ${scheme} system: data-theme=${atBody} before <body>`);
    if (!ok) failures.push(`cookie dh-theme=${saved}: data-theme was ${atBody} when <body> was parsed (flash of the wrong theme)`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s) at ${width}px:\n${failures.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}
console.log(
  `\nAll ${pages.length} routes fit ${width}px in both schemes, with no console errors or CSP violations; the theme script runs, toggles and applies a saved choice before first paint.`,
);
