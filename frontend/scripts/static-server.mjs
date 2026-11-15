#!/usr/bin/env node
// A small static server for the demo export (`out/` from `npm run build:static`),
// resolving routes the way the export (trailingSlash) and Cloudflare Pages do:
// `/curate/` -> `curate/index.html`, `/x` -> `x`, `x/index.html` or `x.html`.
// Anything else is a 404, so a missing asset shows up as one.
//
// Used by scripts/check-overflow.mjs (imported) and by CI's Bombadil job
// (run directly, in the background):
//   node scripts/static-server.mjs [outDir] [--port=4173]

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  ".webmanifest": "application/manifest+json",
};

async function resolveFile(outDir, urlPath) {
  let clean;
  try {
    clean = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  const file = path.join(outDir, clean);
  if (file !== outDir && !file.startsWith(outDir + path.sep)) return null;
  for (const candidate of [file, path.join(file, "index.html"), `${file}.html`]) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // try the next form
    }
  }
  return null;
}

/** Serve `outDir` on 127.0.0.1 (`port` 0 picks a free one); resolves to `{ server, base }`. */
export async function serveStatic(outDir, port = 0) {
  const root = path.resolve(outDir);
  const server = createServer(async (req, res) => {
    const file = await resolveFile(root, req.url ?? "/");
    if (!file) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    res.end(await readFile(file));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const outDir = args.find((a) => !a.startsWith("--")) ?? "out";
  const port = Number(args.find((a) => a.startsWith("--port="))?.split("=")[1] ?? 4173);
  const { base } = await serveStatic(outDir, port);
  console.log(`Serving ${path.resolve(outDir)} at ${base}/`);
}
