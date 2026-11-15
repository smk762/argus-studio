import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DemoStrip } from "@/components/DemoStrip";
import { strip } from "../../vendor/dh/dh-strip.mjs";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("dh-shared adoption", () => {
  it("serves the vendored theme script unchanged (re-copy vendor/dh/dh-theme.js to public/ after a sync)", () => {
    expect(read("public/dh-theme.js")).toBe(read("vendor/dh/dh-theme.js"));
  });

  it("renders the strip from dh-strip.mjs with Studio, and only Studio, current", () => {
    const html = renderToStaticMarkup(DemoStrip());
    expect(html).toContain('data-dh-site="studio"');
    expect(html.match(/aria-current/g)).toHaveLength(1);
    expect(html).toContain('<a href="https://studio.dragonhound.dev/" data-dh-site="studio" aria-current="page">Studio</a>');
    for (const l of strip.links) expect(html).toContain(`href="${l.href}"`);
    expect(html).not.toMatch(/<script/i);
  });

  it("matches the vendored dh-strip.html link for link", () => {
    const hrefs = (s: string) => [...s.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs(renderToStaticMarkup(DemoStrip()))).toEqual(hrefs(read("vendor/dh/dh-strip.html")));
  });
});
