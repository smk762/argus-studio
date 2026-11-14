import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DOCS_PAGES } from "@/components/docs/docsNav";
import { SERVICES, getService, serviceHref } from "./services";

const APP = join(__dirname, "..", "app");

describe("service registry", () => {
  it("has unique, slug-shaped ids", () => {
    const ids = SERVICES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(SERVICES.map((s) => [s.id, s] as const))("%s has a page, users and official guides", (id, s) => {
    const page = join(APP, serviceHref(id), "page.mdx");
    expect(existsSync(page), `${page} missing`).toBe(true);
    expect(readFileSync(page, "utf8")).toContain(`<ServiceFacts id="${id}" />`);
    expect(s.usedBy.length).toBeGreaterThan(0);
    expect(s.guides.length).toBeGreaterThan(0);
    for (const g of s.guides) expect(g.url).toMatch(/^https:\/\//);
    for (const u of s.usedBy) if (u.docs) expect(u.docs).toMatch(/^https:\/\/github\.com\/smk762\//);
  });

  it("puts every service in the docs nav", () => {
    const hrefs = new Set(DOCS_PAGES.map((p) => p.href));
    for (const s of SERVICES) expect(hrefs.has(serviceHref(s.id))).toBe(true);
  });

  it("looks services up by id", () => {
    expect(getService("singguard")?.title).toMatch(/SingGuard/);
    expect(getService("nope")).toBeUndefined();
  });
});
