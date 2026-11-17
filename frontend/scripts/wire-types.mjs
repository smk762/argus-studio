#!/usr/bin/env node
// Generates src/lib/generated/<service>.ts from the wire schemas pinned in
// schema/pins.json. Each service publishes its own schema at
// schema/<service>-wire.schema.json in its repo (built with argus_cortex.wire).
// A pin is the service's `dev` commit, its version there and the file's sha256:
// Studio follows each package's dev HEAD, not a release (argus-studio#170). A
// pin whose file lives elsewhere names it in `path` (argus-cortex's
// taxonomy-schema.json); the local copy keeps that file's basename. A pin with
// `"kind": "fixture"` is a data file, not a schema: it is pulled and
// sha-checked like the others but generates no types (argus-forge's
// forge-parity.json, which src/components/curator/forgeParity.test.ts reads).
//
//   node scripts/wire-types.mjs                 regenerate from the committed schemas
//   node scripts/wire-types.mjs --check         fail on drift; reads no network or sibling repo
//   node scripts/wire-types.mjs --pull [svc…]   fetch each pin (or the named ones) at its branch HEAD,
//                                               record commit, version and sha256, regenerate
//
// After a --pull, fix what typecheck reports. .github/workflows/wire-drift.yml
// runs it daily and opens a PR when a package's dev has moved on.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";

import { gitIn, versionAt } from "./release-version.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pinsPath = join(root, "schema", "pins.json");
/** Where the schema lives in the pinned repo. */
const remotePath = (service, pin) => pin.path ?? `schema/${service}-wire.schema.json`;
const schemaPath = (service, pin) => join(root, "schema", basename(remotePath(service, pin)));
const outputPath = (service) => join(root, "src", "lib", "generated", `${service}.ts`);

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
/** How a pin names its source: `smk762/argus-curator@97021d6 (0.15.2.dev2+g97021d6)`. */
export const pinLabel = (pin) => `${pin.repo}@${pin.commit.slice(0, 7)} (${pin.version})`;

/**
 * Pydantic titles every property ("Rel Path"), which the compiler would turn
 * into a named alias per field. Only a model's own title should name a type.
 */
function dropPropertyTitles(node) {
  if (Array.isArray(node)) return node.map(dropPropertyTitles);
  if (node === null || typeof node !== "object") return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "title" && typeof value === "string") continue;
    if (key === "default" || key === "enum" || key === "const") {
      out[key] = value;
    } else if (key === "properties" || key === "$defs") {
      // Here the keys are field and model names, one of which could be "title".
      out[key] = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, dropPropertyTitles(v)]));
    } else {
      out[key] = dropPropertyTitles(value);
    }
  }
  return out;
}

/** Every model in the file, by name: nothing roots them, so nothing else would reach them. */
function rootedSchema(service, schema) {
  const defs = dropPropertyTitles(schema.$defs);
  for (const [name, def] of Object.entries(defs)) def.title = name;
  return {
    title: `${service}Wire`,
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(Object.keys(defs).map((name) => [name, { $ref: `#/$defs/${name}` }])),
    $defs: defs,
  };
}

async function generate(service, pin, text) {
  const banner = [
    `// Generated from ${pinLabel(pin)} ${remotePath(service, pin)}.`,
    "// Do not edit: change schema/pins.json and run `npm run wire:pull`.",
    "",
  ].join("\n");
  return compile(rootedSchema(service, JSON.parse(text)), `${service}Wire`, {
    additionalProperties: false,
    bannerComment: banner,
    format: true,
    style: { printWidth: 120 },
  });
}

async function pull(service, pin) {
  const work = await mkdtemp(join(tmpdir(), `wire-${service}-`));
  try {
    execFileSync("git", ["clone", "--quiet", "--filter=blob:none", "--no-checkout", "--branch", pin.branch, `https://github.com/${pin.repo}.git`, work], {
      stdio: "inherit",
    });
    const git = gitIn(work);
    const commit = git("rev-parse", "HEAD").toString().trim();
    const text = git("show", `${commit}:${remotePath(service, pin)}`).toString();
    await writeFile(schemaPath(service, pin), text);
    return { ...pin, commit, version: versionAt(git, commit), sha256: sha256(text) };
  } finally {
    // maxRetries: git may still be writing in .git (auto maintenance) as the clone is removed (ENOTEMPTY).
    await rm(work, { recursive: true, force: true, maxRetries: 5 });
  }
}

async function main() {
  const [mode, ...only] = process.argv.slice(2);
  if (mode !== undefined && mode !== "--check" && mode !== "--pull") {
    throw new Error(`unknown option ${mode}`);
  }
  const pins = JSON.parse(await readFile(pinsPath, "utf8"));
  for (const name of only) if (!(name in pins)) throw new Error(`no pin named ${name}`);
  const problems = [];

  for (const [service, listed] of Object.entries(pins)) {
    const pulling = mode === "--pull" && (only.length === 0 || only.includes(service));
    const pin = pulling ? await pull(service, listed) : listed;
    pins[service] = pin;
    const text = await readFile(schemaPath(service, pin), "utf8");
    if (sha256(text) !== pin.sha256) {
      problems.push(`schema/${basename(remotePath(service, pin))} is not the file pinned at ${pinLabel(pin)}`);
      continue;
    }
    if (pin.kind === "fixture") continue;
    const generated = await generate(service, pin, text);
    if (mode !== "--check") {
      await mkdir(dirname(outputPath(service)), { recursive: true });
      await writeFile(outputPath(service), generated);
      continue;
    }
    const committed = await readFile(outputPath(service), "utf8").catch(() => null);
    if (committed !== generated) {
      problems.push(`src/lib/generated/${service}.ts does not match ${pinLabel(pin)}`);
    }
  }

  if (mode === "--pull") await writeFile(pinsPath, `${JSON.stringify(pins, null, 2)}\n`);
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    console.error("Run `npm run wire:types` to regenerate, or `npm run wire:pull` after changing a pin.");
    process.exit(1);
  }
  console.log(mode === "--check" ? "Generated wire types match the pinned schemas." : "Wire types written.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
