// External link check for the /docs pages (argus-studio#172).
//
// Collects every http(s) URL in the docs sources (src/app/docs/**/*.mdx and the
// service registry in src/content/), fetches each one following redirects, and
// fails if any final response is not 2xx. Run on a schedule by
// .github/workflows/docs-links.yml, not on every PR, so CI never depends on a
// third party's uptime.
//
//   node scripts/check-links.mjs [--list]   (npm run docs:links)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SOURCES = [join(ROOT, "src/app/docs"), join(ROOT, "src/content")];
const URL_RE = /https?:\/\/[^\s"'`<>)\]]+/g;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(mdx|ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [p] : [];
  });
}

// Docs show example URLs too (`http://localhost:8188`, `http://nudenet:8080`,
// `http://host.docker.internal:11434/v1`). Only a dotted public hostname is a link.
function isPublic(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return host.includes(".") && host !== "host.docker.internal" && !/^[\d.]+$/.test(host);
}

function collect() {
  const urls = new Map();
  for (const file of SOURCES.flatMap(walk)) {
    for (const m of readFileSync(file, "utf8").matchAll(URL_RE)) {
      const url = m[0].replace(/[.,;:]+$/, "");
      if (url.includes("${")) continue; // template literal, not a link
      if (!isPublic(url)) continue; // an example URL (localhost, a compose service name)
      if (!urls.has(url)) urls.set(url, file.slice(ROOT.length));
    }
  }
  return urls;
}

async function check(url) {
  const ua = { "user-agent": "argus-studio-docs-link-check (+https://github.com/smk762/argus-studio)" };
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow", headers: ua, signal: AbortSignal.timeout(20_000) });
      await res.body?.cancel();
      if (res.ok) return null;
      last = `HTTP ${res.status}`;
      if (res.status < 500 && res.status !== 429) break;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  return last;
}

const urls = collect();
if (process.argv.includes("--list")) {
  for (const url of urls.keys()) console.log(url);
  process.exit(0);
}

const queue = [...urls.keys()];
const failures = [];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      const problem = await check(url);
      if (problem) failures.push({ url, problem, file: urls.get(url) });
    }
  }),
);

console.log(`checked ${urls.size} external links`);
for (const f of failures) console.log(`BROKEN ${f.url}  (${f.problem})  in ${f.file}`);
process.exit(failures.length ? 1 : 0);
