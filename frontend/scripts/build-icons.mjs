// Build Studio's favicon and app icons from the argus-studio package mark (brand/).
//
//   npm i --no-save playwright && node scripts/build-icons.mjs   (dev-time only; outputs are committed)
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROME=/path/to/chrome also work.
//
// Source: brand/argus-studio-{light,dark,mono}.svg, copied from argus-cortex dev
// brand/packages/studio/ (cortex e44699e). To update: re-copy them, then re-run this. Same recipe as
// dragonhound-site scripts/build-favicons.mjs:
//   public/favicon.svg            light mark, dark mark in dark tabs (prefers-color-scheme)
//   public/favicon.ico            16 + 32, PNG-in-ICO, on an opaque tile (readable on any tab bar)
//   public/apple-touch-icon.png   180, square opaque tile (iOS rounds the corners)
//   public/icon-192.png, icon-512.png + public/site.webmanifest
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PUB = join(ROOT, "public");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const light = readFileSync(join(ROOT, "brand/argus-studio-light.svg"), "utf8").trim();
const dark = readFileSync(join(ROOT, "brand/argus-studio-dark.svg"), "utf8").trim();
const inner = (svg) => svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
// The tile is the family's dark background (dh-tokens --dh-bg, dark); the dark-scheme mark sits on it.
const TILE = "#121416";

// SVG favicon: both marks, one shown per scheme.
writeFileSync(
  join(PUB, "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style>.d{display:none}@media (prefers-color-scheme:dark){.l{display:none}.d{display:inline}}</style>` +
    `<g class="l">${inner(light)}</g><g class="d">${inner(dark)}</g></svg>\n`,
);

const tile = (size, { radius = 0.2, scale = 0.84 } = {}) => {
  const m = ((1 - scale) / 2) * 24;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">` +
    `<rect width="24" height="24" rx="${radius * 24}" fill="${TILE}"/>` +
    `<g transform="translate(${m} ${m}) scale(${scale})">${inner(dark)}</g></svg>`
  );
};

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage();
const png = async (markup, size) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  return page.locator("svg").screenshot({ omitBackground: true });
};
const out = {
  16: await png(tile(16, { radius: 0.18, scale: 1 }), 16),
  32: await png(tile(32, { radius: 0.18, scale: 0.96 }), 32),
  "apple-touch-icon.png": await png(tile(180, { radius: 0, scale: 0.78 }), 180),
  "icon-192.png": await png(tile(192, { scale: 0.8 }), 192),
  "icon-512.png": await png(tile(512, { scale: 0.8 }), 512),
};
await browser.close();

// ICO with PNG payloads (every current browser, Windows Vista+).
const ico = (images) => {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(([size, buf], i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size, e);
    head.writeUInt8(size, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(buf.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += buf.length;
  });
  return Buffer.concat([head, ...images.map(([, b]) => b)]);
};
writeFileSync(join(PUB, "favicon.ico"), ico([[16, out[16]], [32, out[32]]]));
for (const f of ["apple-touch-icon.png", "icon-192.png", "icon-512.png"]) writeFileSync(join(PUB, f), out[f]);
writeFileSync(
  join(PUB, "site.webmanifest"),
  JSON.stringify(
    {
      name: "Argus Studio",
      short_name: "Studio",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      theme_color: TILE,
      background_color: TILE,
      display: "browser",
    },
    null,
    2,
  ) + "\n",
);
console.log("icons: favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, site.webmanifest -> public/");
