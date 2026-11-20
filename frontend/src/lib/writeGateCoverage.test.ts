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
    if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) {
      fns.push({ name: stmt.name.text, body: stmt.body, params: paramTypes(stmt) });
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

/** A `fetch` that is not provably a GET: any `method` but the literal "GET". */
function isWrite(call: ts.CallExpression): boolean {
  if (calleeName(call) !== "fetch") return false;
  const init = call.arguments[1];
  if (!init) return false;
  // An init passed by name could carry any method, so it counts as a write.
  if (!ts.isObjectLiteralExpression(init)) return true;
  for (const prop of init.properties) {
    if (ts.isSpreadAssignment(prop)) return true;
    if (!prop.name || !ts.isIdentifier(prop.name) || prop.name.text !== "method") continue;
    if (ts.isShorthandPropertyAssignment(prop)) return true;
    return !(
      ts.isPropertyAssignment(prop) &&
      ts.isStringLiteral(prop.initializer) &&
      prop.initializer.text.toUpperCase() === "GET"
    );
  }
  return false;
}

/** The literal method of a write, or null when it is not a literal. */
function methodOf(call: ts.CallExpression): string | null {
  const init = call.arguments[1];
  if (!init || !ts.isObjectLiteralExpression(init)) return null;
  for (const prop of init.properties) {
    if (ts.isPropertyAssignment(prop) && prop.name.getText() === "method" && ts.isStringLiteral(prop.initializer)) {
      return prop.initializer.text.toUpperCase();
    }
  }
  return null;
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
    `;
    expect(writersIn("x.ts", sample)).toEqual([
      { key: "x.ts gated", gated: true, confirmed: false },
      { key: "x.ts late", gated: false, confirmed: null },
      { key: "x.ts bare", gated: false, confirmed: null },
      { key: "x.ts byName", gated: false, confirmed: null },
      { key: "x.ts spread", gated: false, confirmed: null },
      { key: "x.ts arrow", gated: false, confirmed: null },
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
});
