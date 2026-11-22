import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// CLAUDE.md's "Must never happen" rules that are about the shape of the repo
// rather than the behaviour of a module. Each test here is the check a row of
// that table names, so a rule and its enforcement move together.

const frontend = process.cwd();
const repo = join(frontend, "..");
const read = (path: string) => readFileSync(path, "utf8");
/** A file's lines with `#` comments dropped, for YAML, Dockerfiles and env files. */
const code = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/(^|\s)#.*$/, ""))
    .join("\n");

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(path);
  }
  return out;
}

// The repo root is absent when only frontend/ is mounted (the Docker recipe in
// CLAUDE.md). CI checks out the whole repo, so there the root rules must run.
const hasRepo = existsSync(join(repo, "compose.yaml"));

/**
 * The name of the call whose argument list holds position `at` directly (the innermost unclosed `(` to its left),
 * or null. `f(a, devMode())` gives "f"; `f(g(devMode()))` gives "g".
 */
export function enclosingCall(line: string, at: number): string | null {
  let depth = 0;
  for (let j = at - 1; j >= 0; j -= 1) {
    const c = line[j];
    if (c === ")") depth += 1;
    else if (c === "(") {
      if (depth === 0) return /([A-Za-z_$][\w$]*)\s*$/.exec(line.slice(0, j))?.[1] ?? null;
      depth -= 1;
    }
  }
  return null;
}

describe("repo rules", () => {
  it("runs the repo-root rules in CI", () => {
    if (process.env.CI) expect(hasRepo).toBe(true);
  });

  it.skipIf(!hasRepo)("the release image takes no build-time configuration", () => {
    const release = code(read(join(repo, ".github/workflows/release.yml")));
    expect(release).toMatch(/docker\/build-push-action/);
    expect(release).not.toMatch(/build-args\s*:/);
    // An ARG is how a build-arg would reach the bundle, so the Dockerfile has none.
    expect(code(read(join(frontend, "Dockerfile")))).not.toMatch(/^\s*ARG\b/im);
  });

  it.skipIf(!hasRepo)("only compose.train.yaml arms live training", () => {
    const composes = readdirSync(repo).filter((f) => /^compose.*\.ya?ml$/.test(f));
    expect(composes).toContain("compose.train.yaml");
    const arms = (text: string) => /ARGUS_FORGE_READONLY\s*[=:]\s*["']?0|argus-forge:[^\s"']*-train/.test(code(text));
    expect(composes.filter((f) => arms(read(join(repo, f))))).toEqual(["compose.train.yaml"]);
    // The example env must not arm it either: compose reads .env for every stack.
    expect(arms(read(join(repo, ".env.example")))).toBe(false);
  });

  it.skipIf(!hasRepo)("no workflow layers compose.train.yaml", () => {
    const dir = join(repo, ".github/workflows");
    const users = readdirSync(dir).filter((f) => code(read(join(dir, f))).includes("compose.train"));
    expect(users).toEqual([]);
  });

  it("next.config.ts pins no headers, so the CSP stays per request", () => {
    // A static header cannot carry a per-request nonce (src/proxy.ts sets the policy).
    const config = read(join(frontend, "next.config.ts"));
    expect(config).not.toMatch(/\bheaders\s*[:(]/);
    expect(config).not.toMatch(/content-security-policy/i);
  });

  it("dev mode reaches nothing but the policy list", () => {
    // DEVMODE's whole reach in the browser is which SingGuard policies are
    // offered. Deleting is the servers' call (their /health), and nothing else
    // (viewing, move, bakes, fetches, NSFW blur) may read the flag.
    const files = sources(join(frontend, "src"));
    const rel = (path: string) => path.slice(frontend.length + 1);

    const flagReaders = files.filter((f) => /\.devMode\b/.test(read(f))).map(rel);
    expect(flagReaders).toEqual(["src/lib/curatorEnv.ts"]);

    const stray: string[] = [];
    let uses = 0;
    for (const file of files) {
      if (rel(file) === "src/lib/curatorEnv.ts") continue;
      read(file)
        .split("\n")
        .forEach((line, i) => {
          // Each call on its own: every devMode() must be a direct argument of offeredPolicies(…).
          for (const m of line.matchAll(/\bdevMode\(\)/g)) {
            uses += 1;
            if (enclosingCall(line, m.index) !== "offeredPolicies") stray.push(`${rel(file)}:${i + 1}`);
          }
        });
    }
    expect(stray).toEqual([]);
    expect(uses).toBeGreaterThan(0);
  });
});

// Audit pack-argus-studio-5e82b06f27: a second devMode() on an allowed line is checked on its own.
describe("enclosingCall", () => {
  const at = (line: string, n = 0) => [...line.matchAll(/devMode\(\)/g)][n].index;
  it("names the call a devMode() is a direct argument of", () => {
    expect(enclosingCall("offeredPolicies(a, { b }, devMode())", at("offeredPolicies(a, { b }, devMode())"))).toBe("offeredPolicies");
    const line = "{offeredPolicies(p, c, devMode()).map(render)} <Img blur={nsfwBlur(devMode())} />";
    expect(enclosingCall(line, at(line, 0))).toBe("offeredPolicies");
    expect(enclosingCall(line, at(line, 1))).toBe("nsfwBlur");
    expect(enclosingCall("offeredPolicies(wrap(devMode()))", at("offeredPolicies(wrap(devMode()))"))).toBe("wrap");
    expect(enclosingCall("const x = devMode();", at("const x = devMode();"))).toBeNull();
  });
});
