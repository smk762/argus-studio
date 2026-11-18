import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CONCEPTS, getConcept } from "@/content/concepts";
import { METRIC_LABELS } from "@/lib/proofApi";

// #42: the docs stay complete and consistent. Every concept the tools point at
// exists, every cross-link resolves, and every concept page renders its own
// registry entry, so a tooltip, the Learn panel (#39) and /docs can't drift.

const SRC = join(__dirname, "..");
const APP = join(SRC, "app");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "generated" ? [] : sourceFiles(path);
    return /\.(tsx?|mdx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Every concept id written as a literal: conceptId="x" / conceptId={"x"} / <ConceptBody id="x" />. */
function referencedIds(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/(?:conceptId=\{?|<ConceptBody id=)"([a-z_]+)"/g)) found.set(m[1], file.replace(SRC, "src"));
  }
  return found;
}

const concepts = Object.values(CONCEPTS);

describe("concept registry", () => {
  it("every concept id the code uses exists", () => {
    const refs = referencedIds();
    expect(refs.size).toBeGreaterThan(5);
    for (const [id, file] of refs) expect(getConcept(id), `${id} in ${file}`).toBeDefined();
  });

  it("every proof metric has a concept, and its label comes from it", () => {
    for (const m of METRIC_LABELS) {
      const c = getConcept(m.conceptId);
      expect(c, m.key).toBeDefined();
      expect(m.label).toBe(c!.title);
    }
    expect(getConcept("metric_diversity")).toBeDefined();
  });

  // Cases come from the entries, so a concept filed under the wrong key (a
  // copy-paste leaving metric_fid = { id: "metric_clip" }) fails here.
  it.each(Object.entries(CONCEPTS).map(([key, c]) => [key, c] as const))("%s: id matches its key, text is filled, related ids exist", (id, c) => {
    expect(c.id).toBe(id);
    expect(c.title.trim()).not.toBe("");
    expect(c.summary.trim()).not.toBe("");
    expect(c.body.trim()).not.toBe("");
    for (const r of ("related" in c ? c.related : undefined) ?? []) expect(getConcept(r), `${id} -> ${r}`).toBeDefined();
  });

  it.each(concepts.filter((c) => "href" in c && c.href).map((c) => [c.id, (c as { href: string }).href] as const))(
    "%s: its doc page %s exists and renders this concept",
    (id, href) => {
      const page = join(APP, href, "page.mdx");
      expect(existsSync(page), page).toBe(true);
      expect(readFileSync(page, "utf8")).toContain(`<ConceptBody id="${id}"`);
    },
  );
});

// Audit pack-argus-studio-c95c5d1c94: inherited keys are not concepts.
describe("getConcept", () => {
  it.each(["constructor", "toString", "__proto__", "hasOwnProperty"])("returns undefined for %s", (id) => {
    expect(getConcept(id)).toBeUndefined();
  });
});
