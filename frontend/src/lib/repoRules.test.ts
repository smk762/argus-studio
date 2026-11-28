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
 * or null. `f(a, devMode())` gives "f"; `f(g(devMode()))` gives "g". Inside an object or array literal it is null:
 * `f(p, { blur: devMode() })` passes the value on in a field, not as an argument of `f`.
 */
export function enclosingCall(line: string, at: number): string | null {
  let depth = 0;
  for (let j = at - 1; j >= 0; j -= 1) {
    const c = line[j];
    if (c === ")" || c === "]" || c === "}") depth += 1;
    else if (c === "(" || c === "[" || c === "{") {
      if (depth > 0) depth -= 1;
      else if (c === "(") return /([A-Za-z_$][\w$]*)\s*$/.exec(line.slice(0, j))?.[1] ?? null;
      else return null;
    }
  }
  return null;
}

/**
 * The lines of a file that import `devMode` and then use it other than by calling it (`useX(devMode)`,
 * `const d = devMode`) or import it under another name: a value the call scan cannot follow.
 */
export function devModeAliases(text: string): number[] {
  const imports = [...text.matchAll(/import\s*(?:type\s*)?\{[^}]*\}\s*from\s*["'][^"']+["'];?/g)].filter((m) =>
    /\bdevMode\b/.test(m[0]),
  );
  if (!imports.length) return [];
  const lineOf = (index: number) => text.slice(0, index).split("\n").length;
  const stray = new Set<number>();
  const importSpans = imports.map((m) => [m.index, m.index + m[0].length] as const);
  for (const m of imports) if (/\bdevMode\s+as\b/.test(m[0])) stray.add(lineOf(m.index));
  for (const m of text.matchAll(/(?<![.\w$])devMode\b(?!\s*\()/g)) {
    if (importSpans.some(([from, to]) => m.index >= from && m.index < to)) continue;
    stray.add(lineOf(m.index));
  }
  return [...stray].sort((a, b) => a - b);
}

/** Each service of a compose file (comments already dropped), by name: the text of its block. */
function composeServices(text: string): Record<string, string> {
  const lines = text.split("\n").map((line) => line.trimEnd());
  const start = lines.indexOf("services:");
  const out: Record<string, string> = {};
  let name: string | null = null;
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break; // the next top-level key (volumes:)
    const header = /^ {2}([\w-]+):$/.exec(line);
    if (header) {
      name = header[1];
      out[name] = "";
    } else if (name) out[name] += `${line}\n`;
  }
  return out;
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

  it.skipIf(!hasRepo)("every Argus service container carries the suite directory labels", () => {
    // argus-iris's node agents build the suite directory from these labels (argus-cortex#212). A service this
    // stack runs without them never appears in it. `argus.port` is the container port, and ARGUS_PEER repeats
    // the peer name for the process, which cannot read its own labels.
    const expected: Record<string, [peer: string, service: string, port: string]> = {
      "argus-lens": ["lens", "argus-lens", "8100"],
      "argus-curator": ["curator", "argus-curator", "8101"],
      "argus-quarry-server": ["quarry", "argus-quarry", "8102"],
      "argus-forge": ["forge", "argus-forge", "8103"],
      "argus-proof": ["proof", "argus-proof", "8104"],
      "argus-atlas": ["atlas", "argus-atlas", "8105"],
      "argus-darkroom": ["darkroom", "argus-darkroom", "8106"],
      "argus-survey": ["survey", "argus-survey", "8107"],
      "argus-mask": ["mask", "argus-mask", "8109"],
      "argus-puppet": ["puppet", "argus-puppet", "8220"],
    };
    // Not labelled, each for a reason: this UI and sightline (UIs), the upstream NudeNet image and Ollama
    // (third-party), and the two run-to-completion jobs.
    const unlabelled = ["frontend", "argus-sightline", "nudenet", "ollama", "ollama-pull", "argus-quarry"];

    const blocks = composeServices(code(read(join(repo, "compose.yaml"))));
    // A new service must be put in one list or the other.
    expect(Object.keys(blocks).sort()).toEqual([...Object.keys(expected), ...unlabelled].sort());
    for (const name of unlabelled) expect(blocks[name], name).not.toMatch(/argus\.peer|ARGUS_PEER/);
    for (const [name, [peer, service, port]] of Object.entries(expected)) {
      const block = blocks[name];
      expect(block, name).toMatch(/^ {4}labels:$/m);
      expect(block, name).toContain(`\n      argus.peer: ${peer}\n`);
      expect(block, name).toContain(`\n      argus.service: ${service}\n`);
      expect(block, name).toContain("\n      argus.health: /health\n");
      expect(block, name).toContain(`\n      argus.port: "${port}"\n`);
      // The label names the port the container listens on, which is the target of its published port.
      expect(block, name).toMatch(new RegExp(`^ {6}- "\\$\\{[^"]*\\}:${port}"$`, "m"));
      expect(block, name).toMatch(new RegExp(`^ {6}(- ARGUS_PEER=${peer}|ARGUS_PEER: ${peer})$`, "m"));
    }
    // The overrides layer onto those services and must not rename one.
    for (const file of ["compose.gpu.yaml", "compose.train.yaml", "compose.build.yaml"]) {
      expect(code(read(join(repo, file))), file).not.toMatch(/argus\.peer|ARGUS_PEER/);
    }
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
      for (const line of devModeAliases(read(file))) stray.push(`${rel(file)}:${line}`);
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

  // Audit pack-argus-studio-ab2c4b4087: a devMode() inside a literal argument is a field, not the argument.
  it("gives no call for a devMode() inside an object or array literal", () => {
    for (const line of ["offeredPolicies(p, { blur: devMode() })", "offeredPolicies(p, [devMode()])", "offeredPolicies(p, { a: [1, devMode()] })"]) {
      expect(enclosingCall(line, at(line)), line).toBeNull();
    }
    const line = "offeredPolicies(a, { b: [c] }, devMode())";
    expect(enclosingCall(line, at(line))).toBe("offeredPolicies");
  });
});

describe("devModeAliases", () => {
  it("finds devMode passed or kept by reference, or imported under another name", () => {
    const text = [
      'import { devMode, other } from "@/lib/curatorEnv";',
      "const d = devMode;",
      "useThing(devMode);",
      "offeredPolicies(p, c, devMode());",
      "const x = cfg.devMode;",
    ].join("\n");
    expect(devModeAliases(text)).toEqual([2, 3]);
    expect(devModeAliases('import { devMode as dm } from "@/lib/curatorEnv";\ndm();')).toEqual([1]);
    // A file that does not import it (curatorGuard's `devMode` parameter) is not this rule's business.
    expect(devModeAliases("function f(devMode: boolean) { if (devMode) return 1; }")).toEqual([]);
  });
});
