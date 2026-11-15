#!/usr/bin/env node
// Leak check for the static demo export (argus-studio#242, epic #240).
//
// Bombadil's noResourceLeak reads Chrome's node and listener counts without a
// garbage collection, so React's short-lived garbage trips any useful threshold
// (findings on #242). This runs a fixed loop instead: every pipeline page via
// the header nav (client-side navigation), a few in-page interactions on each,
// then back to the caption page, forces a GC (HeapProfiler.collectGarbage) and
// reads the counts there. After warm-up the counts must stay flat; growth
// beyond the limits below across the measured cycles fails.
//
// Serves `out/` with scripts/static-server.mjs. Playwright is not an app
// dependency; install it as for check-overflow.mjs:
//   npm i --no-save playwright@1.65.0 && npx playwright install --with-deps chromium
//
// Usage: node scripts/check-leaks.mjs [outDir] [--cycles=10] [--warmup=2]
// Writes a Markdown table to $GITHUB_STEP_SUMMARY when set.

import { createRequire } from "node:module";
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { serveStatic } from "./static-server.mjs";

const args = process.argv.slice(2);
const outDir = path.resolve(args.find((a) => !a.startsWith("--")) ?? "out");
const opt = (name, fallback) => Number(args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback);
const cycles = opt("cycles", 10);
const warmup = opt("warmup", 2);

// Allowed growth from the post-warm-up baseline to the last cycle, measured
// after a forced GC on the same page. Generous on purpose: a real leak grows
// every cycle, so ten cycles turn even a small one into a clear excess.
const LIMITS = {
  nodes: (base) => Math.max(300, base * 0.2),
  listeners: (base) => Math.max(50, base * 0.2),
  documents: () => 1,
  heapMB: (base) => Math.max(4, base * 0.5),
};

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const { server, base } = await serveStatic(outDir);
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const context = await browser.newContext({ viewport: { width: 1280, height: 844 } });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));

async function measure() {
  for (let i = 0; i < 2; i++) {
    await cdp.send("HeapProfiler.collectGarbage");
    await page.waitForTimeout(150);
  }
  const { metrics } = await cdp.send("Performance.getMetrics");
  const get = (name) => metrics.find((m) => m.name === name)?.value ?? NaN;
  return {
    nodes: get("Nodes"),
    listeners: get("JSEventListeners"),
    documents: get("Documents"),
    heapMB: Math.round((get("JSHeapUsedSize") / 1048576) * 10) / 10,
  };
}

/** Click if present and enabled; the loop must not depend on any one control. */
async function tap(locator) {
  const target = locator.first();
  if ((await target.count()) && (await target.isEnabled().catch(() => false))) {
    await target.click({ timeout: 2000 }).catch(() => {});
  }
}

const NAV = 'nav[aria-label="Studio tools"] a';

async function go(href) {
  await page.locator(`${NAV}[href="${href}"]`).first().click();
  await page.waitForURL((u) => u.pathname.replace(/\/$/, "") === href.replace(/\/$/, "") || (href === "/" && u.pathname === "/"));
  await page.waitForLoadState("networkidle");
}

/** A few in-page interactions that mount and unmount UI: format buttons, the Learn panel, disclosures, list selections. */
async function interact() {
  for (const label of ["Prose", "Tags", "Balanced", "JSON", "CSV"]) await tap(page.locator(`main button:text-is("${label}")`));
  await tap(page.locator('main button[aria-label^="Learn about"]'));
  await tap(page.locator('dialog[open] button:text-is("Close")'));
  const summaries = page.locator("main details > summary");
  for (let i = 0; i < Math.min(await summaries.count(), 3); i++) {
    await summaries.nth(i).click().catch(() => {});
    await summaries.nth(i).click().catch(() => {});
  }
  const listButtons = page.locator("main li button");
  for (let i = 0; i < Math.min(await listButtons.count(), 3); i++) {
    await listButtons.nth(i).click({ timeout: 2000 }).catch(() => {});
    await closeDialogs();
  }
  await closeDialogs();
}

/** A selection can open a modal (e.g. a record's detail), which blocks the nav: Escape out. */
async function closeDialogs() {
  for (let i = 0; i < 3 && (await page.locator("dialog[open]").count()); i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
  }
}

const rows = [];
let failed = false;
try {
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  const hrefs = await page.locator(NAV).evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  const home = hrefs.find((h) => h === "/") ?? "/";
  const stages = hrefs.filter((h) => h && h !== home);
  if (!stages.length) throw new Error(`no pipeline links under ${NAV}`);

  for (let cycle = 1; cycle <= warmup + cycles; cycle++) {
    for (const href of stages) {
      await go(href);
      await interact();
    }
    await go(home);
    await interact();
    if (cycle >= warmup) rows.push({ cycle, ...(await measure()) });
  }

  const [first, last] = [rows[0], rows.at(-1)];
  console.log(`cycle  nodes  listeners  documents  heapMB   (after GC, on ${home}; ${stages.length} pages per cycle)`);
  for (const r of rows) console.log(`${String(r.cycle).padStart(5)}  ${String(r.nodes).padStart(5)}  ${String(r.listeners).padStart(9)}  ${String(r.documents).padStart(9)}  ${String(r.heapMB).padStart(6)}`);

  const verdicts = Object.entries(LIMITS).map(([key, limit]) => {
    const growth = Math.round((last[key] - first[key]) * 10) / 10;
    const allowed = Math.round(limit(first[key]) * 10) / 10;
    return { key, from: first[key], to: last[key], growth, allowed, ok: growth <= allowed };
  });
  for (const v of verdicts) console.log(`${v.ok ? "ok  " : "FAIL"} ${v.key}: ${v.from} -> ${v.to} (growth ${v.growth}, allowed ${v.allowed})`);
  if (errors.length) console.log(`FAIL ${errors.length} page/console error(s):\n${[...new Set(errors)].map((e) => `  - ${e}`).join("\n")}`);
  failed = verdicts.some((v) => !v.ok) || errors.length > 0;

  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = [
      `## Leak check: ${failed ? "growth over the limit" : "flat"}`,
      "",
      `${cycles} measured cycles after ${warmup} warm-up, each visiting ${stages.length} pages; counts after a forced GC on \`${home}\`.`,
      "",
      "| metric | baseline | last | growth | allowed |",
      "|---|---|---|---|---|",
      ...verdicts.map((v) => `| ${v.ok ? "" : "**"}${v.key}${v.ok ? "" : "**"} | ${v.from} | ${v.to} | ${v.growth} | ${v.allowed} |`),
      "",
      `Per cycle (nodes / listeners / heap MB): ${rows.map((r) => `${r.nodes}/${r.listeners}/${r.heapMB}`).join(", ")}`,
      "",
    ].join("\n");
    await appendFile(process.env.GITHUB_STEP_SUMMARY, md);
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
