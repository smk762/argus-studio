import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { stripHtml } from "@/components/DemoStrip";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("dh-shared adoption", () => {
  it("serves the vendored theme script unchanged (re-copy vendor/dh/dh-theme.js to public/ after a sync)", () => {
    expect(read("public/dh-theme.js")).toBe(read("vendor/dh/dh-theme.js"));
  });

  it("marks Studio, and only Studio, current in the vendored strip", () => {
    const html = stripHtml(read("vendor/dh/dh-strip.html"));
    expect(html.match(/aria-current/g)).toHaveLength(1);
    expect(html).toContain('<a href="https://studio.dragonhound.dev/" aria-current="true">Studio</a>');
    expect(html).not.toContain("<!--");
    expect(html).not.toMatch(/<script/i);
  });
});
