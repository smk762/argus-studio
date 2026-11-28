import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Every backend write is gated in its client (argus-studio#75). writeGates.test.ts
// proves the known writers refuse; this one finds the writers, so a new fetcher
// that sends anything but a GET fails here until it calls a guard before its
// fetch or is listed in UNGATED with the reason it needs none.

const LIB = join(process.cwd(), "src/lib");

/**
 * Non-GET fetchers that run no capability check, and why. Keep the reason
 * honest: "the server advertises nothing to check" is a gap upstream, not a
 * licence, and the entry goes when the server grows a flag.
 */
const UNGATED: Record<string, string> = {
  "forgeApi.ts inspectExport": "POST /inspect only reads an export; safe on a demo-safe host",
  "curatorApi.ts previewKeepSet": "POST /scan/{id}/select only computes a keep-set; nothing is written",
  "curatorApi.ts uploadImages": "curator /health advertises no upload flag; the server refuses without a source root",
  "lensApi.ts captionUrl": "captions one image and returns it; writes nothing",
  "lensApi.ts captionFilesStream": "captions uploaded files and returns them; writes nothing",
  "lensApi.ts captionManifest": "lens /health advertises no write flags (#105); sidecars are opt-in per request",
  "lensApi.ts captionManifestStream": "lens /health advertises no write flags (#105); sidecars are opt-in per request",
  "lensApi.ts immichCaptionStream": "lens /health advertises no write flags (#105); write-back is opt-in per request",
};

interface Fn {
  name: string;
  body: ts.Node;
  /** The declared type of each parameter, as written. */
  params: string[];
}

const paramTypes = (fn: ts.SignatureDeclaration) => fn.parameters.map((p) => p.type?.getText() ?? "");

function topLevelFunctions(source: ts.SourceFile): Fn[] {
  const fns: Fn[] = [];
  for (const stmt of source.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.body) {
      // `export default async function () {…}` has no name of its own.
      fns.push({ name: stmt.name?.text ?? "default", body: stmt.body, params: paramTypes(stmt) });
    } else if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        const init = d.initializer;
        if (ts.isIdentifier(d.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          fns.push({ name: d.name.text, body: init.body, params: paramTypes(init) });
        }
      }
    }
  }
  return fns;
}

function calls(node: ts.Node): ts.CallExpression[] {
  const found: ts.CallExpression[] = [];
  const walk = (n: ts.Node) => {
    if (ts.isCallExpression(n)) found.push(n);
    ts.forEachChild(n, walk);
  };
  walk(node);
  return found;
}

const calleeName = (call: ts.CallExpression) => (ts.isIdentifier(call.expression) ? call.expression.text : null);

/** `fetch(…)`, or `window.fetch(…)`, `globalThis.fetch(…)` and the like: any call whose callee is named fetch. */
const isFetch = (call: ts.CallExpression) =>
  calleeName(call) === "fetch" || (ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === "fetch");

/**
 * A property key's name: `method`, `"method"`, `` `method` `` and `["method"]` all read "method". A computed
 * key that is not a literal could be anything, so it is `undefined`, never a name that rules a write out.
 */
function keyName(name: ts.PropertyName | undefined): string | null | undefined {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name)) {
    const e = name.expression;
    return ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) ? e.text : undefined;
  }
  return null;
}

/**
 * The method an init literal ends up with, read as JavaScript does: the last
 * property wins. "GET" when nothing sets one, the literal when the last setter
 * is one, and `undefined` when the last could set anything (a spread, a
 * shorthand or non-literal `method`, a computed key that is not a literal).
 */
function finalMethod(init: ts.ObjectLiteralExpression): string | undefined {
  let method: string | undefined = "GET";
  for (const prop of init.properties) {
    if (ts.isSpreadAssignment(prop)) {
      method = undefined;
      continue;
    }
    const name = keyName(prop.name);
    if (name === undefined) method = undefined;
    else if (name === "method") {
      method =
        ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.initializer) ? prop.initializer.text.toUpperCase() : undefined;
    }
  }
  return method;
}

/** A `fetch` that is not provably a GET: any `method` but the literal "GET". */
function isWrite(call: ts.CallExpression): boolean {
  if (!isFetch(call)) return false;
  const init = call.arguments[1];
  if (!init) return false;
  // An init passed by name could carry any method, so it counts as a write.
  if (!ts.isObjectLiteralExpression(init)) return true;
  return finalMethod(init) !== "GET";
}

/** The literal method of a write, or null when it is not a literal (or a later property could replace it). */
function methodOf(call: ts.CallExpression): string | null {
  const init = call.arguments[1];
  if (!init || !ts.isObjectLiteralExpression(init)) return null;
  return finalMethod(init) ?? null;
}

/**
 * A write that removes something: a DELETE, a URL with a `/purge` or `/delete`
 * segment, or a function named for it (the purge helpers take their path as an
 * argument, so only the name says what they do).
 */
function isDestructive(fn: Fn, writes: ts.CallExpression[]): boolean {
  if (/purge|delete|remove/i.test(fn.name)) return true;
  return writes.some((w) => methodOf(w) === "DELETE" || /\/(purge|delete)\b/.test(w.arguments[0]?.getText() ?? ""));
}

/**
 * Writes this scan cannot judge: a write fetch outside every function
 * {@link topLevelFunctions} sees (an object-literal or class method, an arrow
 * wrapped in a call, module scope). Each is named by its line, and must move
 * into a top-level function, where its guard and confirmation are checked.
 */
function unjudgedWrites(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const bodies = topLevelFunctions(source).map((fn) => fn.body);
  const inside = (call: ts.CallExpression) => bodies.some((b) => b.getStart() <= call.getStart() && call.getEnd() <= b.getEnd());
  return calls(source)
    .filter((c) => isWrite(c) && !inside(c))
    .map((c) => `${file}:${source.getLineAndCharacterOfPosition(c.getStart()).line + 1}`);
}

interface Writer {
  key: string;
  gated: boolean;
  /** Null for a write that removes nothing; otherwise whether it spends a confirmation first. */
  confirmed: boolean | null;
}

function writersIn(file: string, text: string): Writer[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const fns = topLevelFunctions(source);

  // A guard is requireCapability, or a function of this file that calls one.
  const guards = new Set(["requireCapability"]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const fn of fns) {
      if (guards.has(fn.name)) continue;
      const guardsItself = calls(fn.body).some((c) => guards.has(calleeName(c) ?? ""));
      const sends = calls(fn.body).some(isWrite);
      // A writer that guards itself is a gated writer, not a guard for others.
      if (guardsItself && !sends) {
        guards.add(fn.name);
        grew = true;
      }
    }
  }

  const writers: Writer[] = [];
  for (const fn of fns) {
    const all = calls(fn.body);
    const writes = all.filter(isWrite);
    if (!writes.length) continue;
    const firstWrite = Math.min(...writes.map((w) => w.getStart()));
    const gated = all.some((c) => guards.has(calleeName(c) ?? "") && c.getStart() < firstWrite);
    const spends = all.some((c) => calleeName(c) === "spendConfirmation" && c.getStart() < firstWrite);
    const confirmed = isDestructive(fn, writes) ? spends && fn.params.includes("Confirmed") : null;
    writers.push({ key: `${file} ${fn.name}`, gated, confirmed });
  }
  return writers;
}

const clients = readdirSync(LIB)
  .filter((f) => /Api\.ts$/.test(f))
  .sort();
const writers = clients.flatMap((f) => writersIn(f, readFileSync(join(LIB, f), "utf8")));

describe("write gate coverage", () => {
  it("finds the clients and their writers", () => {
    expect(clients).toEqual(
      expect.arrayContaining(["atlasApi.ts", "curatorApi.ts", "darkroomApi.ts", "forgeApi.ts", "galleryApi.ts", "lensApi.ts", "proofApi.ts"]),
    );
    // If the scan stops seeing fetches, every check below passes on nothing.
    expect(writers.length).toBeGreaterThanOrEqual(25);
    for (const f of clients) expect(writers.some((w) => w.key.startsWith(`${f} `)), f).toBe(true);
  });

  it("every write fetcher runs a capability guard before its fetch, or says why not", () => {
    const ungated = writers.filter((w) => !w.gated && !(w.key in UNGATED)).map((w) => w.key);
    expect(ungated).toEqual([]);
  });

  it("every fetcher that deletes takes the user's confirmation and spends it before its fetch (#262)", () => {
    const destructive = writers.filter((w) => w.confirmed !== null);
    // curator: a cached scan, scan images, every scan. darkroom: an image, the purges. proof: the purges.
    expect(destructive.map((w) => w.key)).toEqual(
      expect.arrayContaining([
        "curatorApi.ts deleteCachedScan",
        "curatorApi.ts deleteScanImages",
        "curatorApi.ts purgeScans",
        "darkroomApi.ts removeImage",
        "darkroomApi.ts postPurge",
        "proofApi.ts postPurge",
      ]),
    );
    expect(destructive.filter((w) => !w.confirmed).map((w) => w.key)).toEqual([]);
  });

  // Audit pack-argus-studio-bcad7ed314: a writer the scan cannot see would pass every check above.
  it("finds every write fetch inside a function it judges", () => {
    expect(clients.flatMap((f) => unjudgedWrites(f, readFileSync(join(LIB, f), "utf8")))).toEqual([]);
  });

  it("lists no exemption for a fetcher that is gated or gone", () => {
    const live = new Set(writers.filter((w) => !w.gated).map((w) => w.key));
    expect(Object.keys(UNGATED).filter((k) => !live.has(k))).toEqual([]);
  });

  it("sees through the shapes a write can take", () => {
    const sample = `
      const requireWrite = (s) => requireCapability(memo, allows, "no", s);
      export async function gated() { await requireWrite(); return fetch(u, { method: "DELETE" }); }
      export async function late() { const r = await fetch(u, { method: "POST" }); await requireWrite(); return r; }
      export async function bare() { return fetch(u, { method: "POST" }); }
      export async function byName(init) { return fetch(u, init); }
      export async function spread(o) { return fetch(u, { ...o }); }
      export const arrow = async () => fetch(u, { method: verb });
      export async function read() { return fetch(u, { signal }); }
      export async function plainGet() { return fetch(u, { method: "GET" }); }
      export async function viaWindow() { return window.fetch(u, { method: "POST" }); }
      export async function viaGlobal() { return globalThis.fetch(u, { method: "DELETE" }); }
      export async function quoted() { return fetch(u, { "method": "POST" }); }
      export async function computed() { return fetch(u, { ["method"]: "DELETE" }); }
      export async function anyKey(k) { return fetch(u, { [k]: "POST" }); }
      export async function quotedGet() { return fetch(u, { "method": "GET" }); }
      export async function getThenSpread(o) { return fetch(u, { method: "GET", ...o }); }
      export async function getThenKey(k) { return fetch(u, { method: "GET", [k]: "POST" }); }
      export async function getThenDelete() { return fetch(u, { method: "GET", method: "DELETE" }); }
      export async function postThenSpread(o) { return fetch(u, { method: "POST", ...o }); }
      export async function spreadThenGet(o) { return fetch(u, { ...o, method: "GET" }); }
    `;
    expect(writersIn("x.ts", sample)).toEqual([
      { key: "x.ts gated", gated: true, confirmed: false },
      { key: "x.ts late", gated: false, confirmed: null },
      { key: "x.ts bare", gated: false, confirmed: null },
      { key: "x.ts byName", gated: false, confirmed: null },
      { key: "x.ts spread", gated: false, confirmed: null },
      { key: "x.ts arrow", gated: false, confirmed: null },
      // Audit pack-argus-studio-6b90a662eb: a member-expression fetch is a fetch.
      { key: "x.ts viaWindow", gated: false, confirmed: null },
      { key: "x.ts viaGlobal", gated: false, confirmed: false },
      // Audit pack-argus-studio-e2949a586f: a quoted or computed key can name the method too.
      { key: "x.ts quoted", gated: false, confirmed: null },
      { key: "x.ts computed", gated: false, confirmed: false },
      { key: "x.ts anyKey", gated: false, confirmed: null },
      // Audit pack-argus-studio-3c06c8d3e5: the last property wins, so a GET can be overridden after it.
      { key: "x.ts getThenSpread", gated: false, confirmed: null },
      { key: "x.ts getThenKey", gated: false, confirmed: null },
      { key: "x.ts getThenDelete", gated: false, confirmed: false },
      { key: "x.ts postThenSpread", gated: false, confirmed: null },
    ]);
  });

  it("sees the writes no top-level function holds", () => {
    const sample = `
      export const api = { async del() { return fetch(u, { method: "DELETE" }); } };
      export class Client { async post() { return fetch(u, { method: "POST" }); } }
      export const wrapped = withRetry(async () => fetch(u, { method: "POST" }));
      export default async function () { return fetch(u, { method: "DELETE" }); }
      export async function judged() { return fetch(u, { method: "POST" }); }
      export async function read() { return fetch(u); }
    `;
    expect(unjudgedWrites("x.ts", sample)).toEqual(["x.ts:2", "x.ts:3", "x.ts:4"]);
    expect(writersIn("x.ts", sample).map((w) => w.key)).toEqual(["x.ts default", "x.ts judged"]);
  });

  it("tells a confirmed delete from one that only looks it", () => {
    const sample = `
      export async function dropIt(id: string, confirmed: Confirmed) { spendConfirmation(confirmed); await requireCapability(m, a, "no"); return fetch(u, { method: "DELETE" }); }
      export async function unasked(id: string) { await requireCapability(m, a, "no"); return fetch(u, { method: "DELETE" }); }
      export async function unspent(id: string, confirmed: Confirmed) { await requireCapability(m, a, "no"); return fetch(u, { method: "DELETE" }); }
      export async function tooLate(id: string, confirmed: Confirmed) { const r = await fetch(\`\${base()}/purge/\${id}\`, { method: "POST" }); spendConfirmation(confirmed); return r; }
      export async function purgeThings(path: string) { return fetch(base() + path, { method: "POST" }); }
      export async function save(body: string) { return fetch(u, { method: "POST", body }); }
    `;
    expect(writersIn("x.ts", sample).map((w) => [w.key, w.confirmed])).toEqual([
      ["x.ts dropIt", true],
      ["x.ts unasked", false],
      ["x.ts unspent", false],
      ["x.ts tooLate", false],
      ["x.ts purgeThings", false],
      ["x.ts save", null],
    ]);
  });
});
