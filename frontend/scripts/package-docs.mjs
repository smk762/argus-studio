#!/usr/bin/env node
// The Packages section of /docs (argus-studio#170): each package's own docs,
// imported from its repo at the HEAD of its `dev` branch and committed here, so
// a build needs no network. Ported from argus-cull's curator import
// (cull#63, web/scripts/curator-docs.mjs) and generalised to every package.
//
//   node scripts/package-docs.mjs --pull [<short> ...]   network: import at each dev HEAD (npm run docs:pull)
//   node scripts/package-docs.mjs --check                 offline: the committed copies match the record (npm run docs:check)
//
// The record is schema/docs.json: per package, the dev commit and the version at
// it, the pages (file, route slug, title) and a sha256 of every file written.
// Docs land in src/content/packages/<short>/ and the images they reference in
// public/package-docs/<short>/. Never hand-edit either: fix the doc upstream in
// the package's dev branch and pull again.
//
// Every fetched file goes through the opsec gate (scripts/opsec.mjs) before
// anything is written. It fails closed: one hit in any package writes nothing,
// and it is fixed in that package, never redacted here.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { denylistFromEnv, opsecFindings } from "./opsec.mjs";
import { BRANCH, PACKAGES, repoImages, slugOf, titleOf, versionOf } from "./package-docs-lib.mjs";

const frontend = dirname(dirname(fileURLToPath(import.meta.url)));
export const RECORD_PATH = join(frontend, "schema", "docs.json");
export const contentDir = (short) => join(frontend, "src", "content", "packages", short);
export const imagesDir = (short) => join(frontend, "public", "package-docs", short);

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const rel = (path) => path.slice(frontend.length + 1);

async function fetchPackage(pkg) {
  const work = await mkdtemp(join(tmpdir(), `package-docs-${pkg.short}-`));
  try {
    const git = (...args) => execFileSync("git", ["-C", work, ...args], { maxBuffer: 64 << 20 });
    execFileSync("git", ["clone", "--quiet", "--filter=blob:none", "--no-checkout", "--branch", BRANCH, `https://github.com/${pkg.repo}.git`, work], {
      stdio: "inherit",
    });
    const commit = git("rev-parse", "HEAD").toString().trim();
    const version = versionOf(git("describe", "--tags", "--long", "--match", "v[0-9]*", commit).toString());
    const show = (path) => git("show", `${commit}:${path}`);
    const docs = Object.fromEntries(pkg.docs.map((path) => [path, show(path).toString()]));
    const held = Object.fromEntries((pkg.held ?? []).map((path) => [path, show(path).toString()]));
    const images = {};
    for (const [path, text] of Object.entries(docs)) for (const at of repoImages(pkg, path, text)) images[at] = show(at);
    return { commit, version, docs, held, images };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function pull(shorts) {
  const unknown = shorts.filter((short) => !PACKAGES.some((pkg) => pkg.short === short));
  if (unknown.length > 0) throw new Error(`unknown package ${unknown.join(", ")}; one of ${PACKAGES.map((pkg) => pkg.short).join(", ")}`);
  const chosen = shorts.length > 0 ? PACKAGES.filter((pkg) => shorts.includes(pkg.short)) : PACKAGES;
  const record = await readRecord();
  const denylist = denylistFromEnv();

  const fetched = new Map();
  for (const pkg of chosen) fetched.set(pkg, await fetchPackage(pkg));

  // Gate everything first, so one refusal anywhere writes nothing.
  const refusals = [];
  for (const [pkg, { docs }] of fetched) {
    for (const [path, text] of Object.entries(docs)) {
      for (const hit of opsecFindings(text, denylist)) refusals.push(`${pkg.repo} ${path}:${hit.line}: ${hit.rule}`);
    }
  }
  for (const [pkg, { held }] of fetched) {
    for (const [path, text] of Object.entries(held)) {
      const hits = opsecFindings(text, denylist);
      if (hits.length === 0) console.log(`${pkg.repo} ${path} now passes the opsec gate: move it from \`held\` to \`docs\` in scripts/package-docs.mjs and pull again`);
      else console.log(`${pkg.repo} ${path} is still held: ${hits.map((hit) => `line ${hit.line} ${hit.rule}`).join(", ")}`);
    }
  }
  if (refusals.length > 0) {
    throw new Error(
      `opsec gate refused the import; nothing was written. Fix each in the package's dev branch (never here), or leave the file off its allowlist:\n  ${refusals.join("\n  ")}`,
    );
  }

  for (const [pkg, { commit, version, docs, images }] of fetched) {
    await rm(contentDir(pkg.short), { recursive: true, force: true });
    await rm(imagesDir(pkg.short), { recursive: true, force: true });
    const files = {};
    for (const [dir, entries] of [
      [contentDir(pkg.short), docs],
      [imagesDir(pkg.short), images],
    ]) {
      for (const [path, data] of Object.entries(entries)) {
        const out = join(dir, path);
        await mkdir(dirname(out), { recursive: true });
        await writeFile(out, data);
        files[rel(out)] = sha256(data);
      }
    }
    record.packages[pkg.short] = {
      package: pkg.package,
      repo: pkg.repo,
      branch: BRANCH,
      commit,
      version,
      pages: pkg.docs.map((file) => ({ file, slug: slugOf(file), title: titleOf(pkg, file, docs[file]) })),
      held: pkg.held ?? [],
      files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
    };
    console.log(`${pkg.package}: ${Object.keys(files).length} files at ${commit.slice(0, 9)} (${version})`);
  }
  // Nav order, whatever order the packages were pulled in.
  record.packages = Object.fromEntries(PACKAGES.filter((pkg) => record.packages[pkg.short]).map((pkg) => [pkg.short, record.packages[pkg.short]]));
  await writeFile(RECORD_PATH, `${JSON.stringify(record, null, 2)}\n`);
}

const COMMENT =
  "Where /docs/packages comes from (argus-studio#170): each package's dev branch at one commit. `npm run docs:pull` writes the docs to src/content/packages/<short>/ and their images to public/package-docs/<short>/, with a sha256 per file here; `npm run docs:check` holds the committed copies to this record offline, and .github/workflows/docs-drift.yml flags a dev branch that moved on. Never hand-edit the imported files.";

async function readRecord() {
  const record = JSON.parse(await readFile(RECORD_PATH, "utf8").catch(() => "{}"));
  return { $comment: COMMENT, packages: record.packages ?? {} };
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

/** Every disagreement between the committed copies and the record. Reads no network. */
export async function check(record, denylist = denylistFromEnv()) {
  const problems = [];
  const pullHint = (short) => `; run \`npm run docs:pull -- ${short}\``;
  const recorded = Object.keys(record.packages ?? {});
  const expected = PACKAGES.map((pkg) => pkg.short);
  if (recorded.join() !== expected.join()) problems.push(`the record lists ${recorded.join(", ") || "nothing"}, the registry ${expected.join(", ")}`);
  const known = new Set(recorded);
  for (const short of await readdir(join(frontend, "src", "content", "packages")).catch(() => [])) {
    if (!known.has(short)) problems.push(`src/content/packages/${short} is not in the record`);
  }
  for (const short of await readdir(join(frontend, "public", "package-docs")).catch(() => [])) {
    if (!known.has(short)) problems.push(`public/package-docs/${short} is not in the record`);
  }

  for (const pkg of PACKAGES) {
    const entry = record.packages?.[pkg.short];
    if (!entry) continue;
    for (const key of ["package", "repo"]) if (entry[key] !== pkg[key]) problems.push(`${pkg.short}: the record's ${key} is ${entry[key]}, the registry's ${pkg[key]}`);
    if (entry.branch !== BRANCH) problems.push(`${pkg.short}: recorded from ${entry.branch}, not ${BRANCH}`);
    if (!/^[0-9a-f]{40}$/.test(entry.commit ?? "")) problems.push(`${pkg.short}: the record's commit ${entry.commit} is not a full sha`);
    if (!entry.version) problems.push(`${pkg.short}: the record has no version`);
    const pages = (entry.pages ?? []).map((page) => page.file);
    if ((entry.held ?? []).join() !== (pkg.held ?? []).join()) problems.push(`${pkg.short}: the record's held files are not the registry's${pullHint(pkg.short)}`);
    if (pages.join() !== pkg.docs.join()) problems.push(`${pkg.short}: the record's pages (${pages.join(", ")}) are not the allowlist (${pkg.docs.join(", ")})${pullHint(pkg.short)}`);

    const listed = entry.files ?? {};
    const onDisk = [...(await listFiles(contentDir(pkg.short))), ...(await listFiles(imagesDir(pkg.short)))];
    for (const file of onDisk) if (!(rel(file) in listed)) problems.push(`${rel(file)} is not in the record`);
    for (const [path, hash] of Object.entries(listed)) {
      const data = await readFile(join(frontend, path)).catch(() => null);
      if (data === null) problems.push(`${path} is in the record but missing${pullHint(pkg.short)}`);
      else if (sha256(data) !== hash) problems.push(`${path} does not match its sha256 in the record (hand-edited?)${pullHint(pkg.short)}`);
    }
    for (const page of entry.pages ?? []) {
      const path = rel(join(contentDir(pkg.short), page.file));
      if (!(path in listed)) {
        problems.push(`${path} is on the allowlist but not in the record${pullHint(pkg.short)}`);
        continue;
      }
      const text = await readFile(join(frontend, path), "utf8").catch(() => "");
      if (page.slug !== slugOf(page.file)) problems.push(`${path}: the record's slug ${page.slug} should be ${slugOf(page.file)}`);
      if (page.title !== titleOf(pkg, page.file, text)) problems.push(`${path}: the record's title ${JSON.stringify(page.title)} is not the file's`);
      for (const hit of opsecFindings(text, denylist)) problems.push(`${path}:${hit.line}: opsec: ${hit.rule}`);
    }
  }
  return problems;
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--pull") {
    await pull(args.slice(1));
    return;
  }
  if (args[0] === "--check") {
    const record = await readRecord();
    const problems = await check(record);
    if (problems.length > 0) {
      console.error(`package docs check failed:\n- ${problems.join("\n- ")}`);
      process.exit(1);
    }
    const files = Object.values(record.packages).reduce((n, entry) => n + Object.keys(entry.files).length, 0);
    console.log(`package docs ok: ${Object.keys(record.packages).length} packages, ${files} files, opsec clean`);
    return;
  }
  console.error("usage: package-docs.mjs --pull [<short> ...] | --check");
  process.exit(2);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
