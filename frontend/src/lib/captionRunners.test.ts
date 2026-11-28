import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Audit packs argus-studio-105776a584 and -dd2a647067: there is no DOM test setup, so hold the page's runners to it here.
describe("the caption page's runners", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(caption)/page.tsx"), "utf8");
  const runner = (name: string) => {
    const from = page.indexOf(`const ${name} = async`);
    expect(from, name).toBeGreaterThan(-1);
    return page.slice(from, page.indexOf("\n  };\n", from));
  };

  it.each(["runUrl", "runFolder", "runManifest", "runUpload", "runImmich"])("%s is tracked and resets through its run", (name) => {
    const body = runner(name);
    expect(body).toMatch(/const run = runs\.current\.begin\(/);
    expect(body).toMatch(/finally \{\s*run\.finish\(resetRun\);\s*\}/);
    expect(body).toMatch(/if \(!run\.shows\(/);
    expect(body).not.toMatch(/setLoading\(false\)/);
  });
});
