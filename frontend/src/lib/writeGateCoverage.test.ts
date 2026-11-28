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
  /** The whole function, or the source file for a fetch outside any function. */
  node: ts.Node;
  /** The declared type of each parameter, as written. */
  params: string[];
}

const paramTypes = (fn: ts.SignatureDeclaration) => fn.parameters.map((p) => p.type?.getText() ?? "");

/** What a function is called: the names on the way out to the file, `api.del` for a method of `const api`. */
function nameOf(fn: ts.Node): string {
  const names: string[] = [];
  for (let n = fn; n && !ts.isSourceFile(n); n = n.parent) {
    const name = (n as Partial<ts.NamedDeclaration>).name;
    if (name && !ts.isCallExpression(n) && !ts.isPropertyAccessExpression(n)) names.unshift(name.getText());
    else if (ts.isConstructorDeclaration(n)) names.unshift("constructor");
  }
  return names.join(".") || "default";
}

/**
 * Every outermost function of the file, whatever holds it: a declaration, an
 * object or class member, an argument of a wrapping call, an unnamed default
 * export. Functions nested in one belong to it. The file itself comes last, for
 * a fetch that runs outside any function.
 */
function outermostFunctions(source: ts.SourceFile): Fn[] {
  const fns: Fn[] = [];
  const walk = (n: ts.Node) => {
    if (ts.isFunctionLike(n) && "body" in n && n.body) fns.push({ name: nameOf(n), node: n, params: paramTypes(n) });
    else ts.forEachChild(n, walk);
  };
  walk(source);
  return [...fns, { name: "(top level)", node: source, params: [] }];
}

/** The nearest function holding a node, or the file. */
function scopeOf(node: ts.Node): ts.Node {
  let n = node.parent;
  while (!ts.isSourceFile(n) && !ts.isFunctionLike(n)) n = n.parent;
  return n;
}

const holds = (scope: ts.Node, node: ts.Node) => scope.getStart() <= node.getStart() && node.getEnd() <= scope.getEnd();

/** `call` runs before `write`: earlier in the text, in the write's own function or one around it (not a sibling). */
const runsBefore = (call: ts.CallExpression, write: ts.CallExpression) =>
  call.getStart() < write.getStart() && holds(scopeOf(call), write);

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
 * The method a `fetch` sends, or null when the source does not say. As in
 * JavaScript the last property wins, so a spread or a computed key after a
 * literal `method` can replace it, and one before it cannot.
 */
function methodOf(call: ts.CallExpression): string | null {
  const init = call.arguments[1];
  if (!init) return "GET";
  // An init passed by name could carry any method.
  if (!ts.isObjectLiteralExpression(init)) return null;
  let method: string | null = "GET";
  for (const prop of init.properties) {
    const name = ts.isSpreadAssignment(prop) ? undefined : keyName(prop.name);
    if (name === undefined) method = null;
    else if (name === "method") {
      const value = ts.isPropertyAssignment(prop) ? prop.initializer : null;
      method = value && ts.isStringLiteralLike(value) ? value.text.toUpperCase() : null;
    }
  }
  return method;
}

/** A `fetch` that is not provably a GET. */
const isWrite = (call: ts.CallExpression) => isFetch(call) && methodOf(call) !== "GET";

/**
 * A write that removes something: a DELETE, a method that could be one, a URL with a `/purge` or `/delete`
 * segment, or a function named for it (the purge helpers take their path as an
 * argument, so only the name says what they do).
 */
function isDestructive(fn: Fn, writes: ts.CallExpression[]): boolean {
  if (/purge|delete|remove/i.test(fn.name)) return true;
  return writes.some((w) => ["DELETE", null].includes(methodOf(w)) || /\/(purge|delete)\b/.test(w.arguments[0]?.getText() ?? ""));
}

interface Writer {
  key: string;
  gated: boolean;
  /** Null for a write that removes nothing; otherwise whether it spends a confirmation first. */
  confirmed: boolean | null;
}

function writersIn(file: string, text: string): Writer[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const fns = outermostFunctions(source);

  // A guard is requireCapability, or a function of this file that calls one.
  const guards = new Set(["requireCapability"]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const fn of fns) {
      if (guards.has(fn.name)) continue;
      const guardsItself = calls(fn.node).some((c) => guards.has(calleeName(c) ?? ""));
      const sends = calls(fn.node).some(isWrite);
      // A writer that guards itself is a gated writer, not a guard for others.
      if (guardsItself && !sends) {
        guards.add(fn.name);
        grew = true;
      }
    }
  }

  const writers: Writer[] = [];
  const seen = new Set<ts.Node>();
  for (const fn of fns) {
    const all = calls(fn.node);
    const writes = all.filter((c) => isWrite(c) && !seen.has(c));
    if (!writes.length) continue;
    writes.forEach((w) => seen.add(w));
    const gated = writes.every((w) => all.some((c) => guards.has(calleeName(c) ?? "") && runsBefore(c, w)));
    const spends = writes.every((w) => all.some((c) => calleeName(c) === "spendConfirmation" && runsBefore(c, w)));
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
      export async function getThenSpread(o) { return fetch(u, { method: "GET", ...o }); }
      export async function getThenKey(k) { return fetch(u, { method: "GET", [k]: "POST" }); }
      export async function postThenSpread(o) { return fetch(u, { method: "POST", ...o }); }
      export async function twice() { return fetch(u, { method: "GET", "method": "DELETE" }); }
      export async function spreadThenGet(o) { return fetch(u, { ...o, method: "GET" }); }
      export async function quotedGet() { return fetch(u, { "method": "GET" }); }
    `;
    expect(writersIn("x.ts", sample)).toEqual([
      { key: "x.ts gated", gated: true, confirmed: false },
      { key: "x.ts late", gated: false, confirmed: null },
      { key: "x.ts bare", gated: false, confirmed: null },
      // A method the source does not name could be DELETE, so it needs a confirmation too.
      { key: "x.ts byName", gated: false, confirmed: false },
      { key: "x.ts spread", gated: false, confirmed: false },
      { key: "x.ts arrow", gated: false, confirmed: false },
      // Audit pack-argus-studio-6b90a662eb: a member-expression fetch is a fetch.
      { key: "x.ts viaWindow", gated: false, confirmed: null },
      { key: "x.ts viaGlobal", gated: false, confirmed: false },
      // Audit pack-argus-studio-e2949a586f: a quoted or computed key can name the method too.
      { key: "x.ts quoted", gated: false, confirmed: null },
      { key: "x.ts computed", gated: false, confirmed: false },
      { key: "x.ts anyKey", gated: false, confirmed: false },
      // Audit pack-argus-studio-154d8f41c4: the last property wins, so what follows `method` can replace it.
      { key: "x.ts getThenSpread", gated: false, confirmed: false },
      { key: "x.ts getThenKey", gated: false, confirmed: false },
      { key: "x.ts postThenSpread", gated: false, confirmed: false },
      { key: "x.ts twice", gated: false, confirmed: false },
    ]);
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

  // Audit pack-argus-studio-d786cd2a73: a writer is found wherever its function sits.
  it("finds writers outside top-level functions", () => {
    const sample = `
      export const api = {
        async safe() { await requireCapability(m, a, "no"); return fetch(u, { method: "POST" }); },
        async del() { return fetch(u, { method: "DELETE" }); },
        arrow: async () => fetch(u, { method: "POST" }),
      };
      class Client { async save() { return fetch(u, { method: "POST" }); } put = async () => fetch(u, { method: "PUT" }); }
      export const wrapped = withRetry(async () => fetch(u, { method: "POST" }));
      export const retried = async () => { await requireCapability(m, a, "no"); return withRetry(() => fetch(u, { method: "POST" })); };
      export function make() {
        return {
          async safe() { await requireCapability(m, a, "no"); return fetch(u, { method: "POST" }); },
          async bare() { return fetch(u, { method: "POST" }); },
        };
      }
      const eager = fetch(u, { method: "POST" });
      export default async function () { return fetch(u, { method: "POST" }); }
    `;
    expect(writersIn("x.ts", sample).map((w) => [w.key, w.gated, w.confirmed])).toEqual([
      ["x.ts api.safe", true, null],
      ["x.ts api.del", false, false],
      ["x.ts api.arrow", false, null],
      ["x.ts Client.save", false, null],
      ["x.ts Client.put", false, null],
      ["x.ts wrapped", false, null],
      ["x.ts retried", true, null],
      // One member's guard does not cover its sibling.
      ["x.ts make", false, null],
      ["x.ts default", false, null],
      ["x.ts (top level)", false, null],
    ]);
  });
});
