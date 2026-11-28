import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
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

/** Production source: a test may name or mock anything these rules are about. */
const isSource = (name: string) => /\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name);

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (isSource(name)) out.push(path);
  }
  return out;
}

// The repo root is absent when only frontend/ is mounted (the Docker recipe in
// CLAUDE.md). CI checks out the whole repo, so there the root rules must run.
const hasRepo = existsSync(join(repo, "compose.yaml"));

/**
 * Every mention of `devMode` in a source file that is not harmless, as line
 * numbers, plus how many times the flag is used as allowed. Allowed: importing
 * it under its own name, calling it as a direct argument of `offeredPolicies(…)`,
 * a parameter of that name, and a property name in a type or an object literal.
 * An alias, a bare reference or a string naming it would carry the flag elsewhere.
 */
function devModeUses(file: string, text: string): { uses: number; stray: number[] } {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const stray: number[] = [];
  let uses = 0;

  const isParam = (node: ts.Node) => {
    for (let n = node.parent; n; n = n.parent) {
      if (ts.isFunctionLike(n) && n.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === "devMode")) return true;
    }
    return false;
  };
  const isOffered = (id: ts.Node) => {
    const call = id.parent;
    if (!ts.isCallExpression(call) || call.expression !== id) return false;
    const outer = call.parent;
    return (
      ts.isCallExpression(outer) &&
      outer.arguments.includes(call) &&
      ts.isIdentifier(outer.expression) &&
      outer.expression.text === "offeredPolicies"
    );
  };
  const harmless = (id: ts.Identifier) => {
    const p = id.parent;
    if (ts.isImportSpecifier(p)) return !p.propertyName;
    if ((ts.isPropertySignature(p) || ts.isPropertyAssignment(p)) && p.name === id) return true;
    // A name after a dot is a read of the flag, never of a parameter.
    return !(ts.isPropertyAccessExpression(p) && p.name === id) && isParam(id);
  };
  const walk = (n: ts.Node) => {
    if ((ts.isIdentifier(n) || ts.isStringLiteralLike(n)) && n.text === "devMode") {
      if (ts.isIdentifier(n) && isOffered(n)) uses += 1;
      else if (!ts.isIdentifier(n) || !harmless(n)) stray.push(source.getLineAndCharacterOfPosition(n.getStart()).line + 1);
    }
    ts.forEachChild(n, walk);
  };
  walk(source);
  return { uses, stray };
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
      const found = devModeUses(file, read(file));
      uses += found.uses;
      stray.push(...found.stray.map((line) => `${rel(file)}:${line}`));
    }
    expect(stray).toEqual([]);
    expect(uses).toBeGreaterThan(0);
  });
});

describe("sources", () => {
  // Audit pack-argus-studio-3d02db1960: component tests are tests too.
  it("leaves every kind of test file out", () => {
    const names = ["a.ts", "a.tsx", "a.test.ts", "a.test.tsx", "a.spec.ts", "a.spec.tsx", "a.css", "latest.ts"];
    expect(names.filter(isSource)).toEqual(["a.ts", "a.tsx", "latest.ts"]);
  });
});

describe("devModeUses", () => {
  const found = (text: string) => devModeUses("x.tsx", text);

  it("allows the policy list and nothing it needs less", () => {
    expect(found("const a = offeredPolicies(p, { b }, devMode());")).toEqual({ uses: 1, stray: [] });
    expect(found('import { devMode } from "@/lib/curatorEnv";\nconst f = (devMode: boolean) => devMode;')).toEqual({ uses: 0, stray: [] });
    expect(found("interface C { devMode: boolean }\nconst c = { devMode: false }; // devMode()")).toEqual({ uses: 0, stray: [] });
  });

  // Audit pack-argus-studio-5e82b06f27: a second devMode() on an allowed line is checked on its own.
  it("checks each call on its own", () => {
    const line = "const a = <p>{offeredPolicies(p, c, devMode()).map(render)} <Img blur={nsfwBlur(devMode())} /></p>;";
    expect(found(line)).toEqual({ uses: 1, stray: [1] });
    expect(found("offeredPolicies(wrap(devMode()));").stray).toEqual([1]);
    expect(found("const x = devMode();").stray).toEqual([1]);
  });

  // Audit pack-argus-studio-f784f84a4c: aliases and uncalled references read the flag too.
  it.each([
    'import { devMode as dev } from "@/lib/curatorEnv";',
    'export { devMode } from "@/lib/curatorEnv";',
    "const f = devMode;",
    "const x = devMode ();",
    "const x = env.devMode();",
    'const x = env["devMode"]();',
    "const { devMode } = env;",
    "const { devMode: f } = env;",
    "const f = (devMode: boolean) => runtimeConfig().devMode;",
    "offeredPolicies(p, c, devMode);",
  ])("flags %s", (text) => {
    expect(found(text).stray).toEqual([1]);
  });
});
