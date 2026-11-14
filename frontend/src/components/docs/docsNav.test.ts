import { describe, expect, it } from "vitest";

import { isFamilyHref } from "@/lib/familyHost";
import { HANDBOOK_ORIGIN } from "@/lib/handbook";

import { DOCS_NAV, DOCS_PAGES, docsPager, isExternalItem } from "./docsNav";

describe("docs nav", () => {
  const external = DOCS_NAV.flatMap((s) => s.items).filter(isExternalItem);

  it("links the moved suite docs on the handbook, a family host (same tab)", () => {
    expect(external.map((i) => i.href)).toEqual([`${HANDBOOK_ORIGIN}/setup/`, `${HANDBOOK_ORIGIN}/packages/`]);
    expect(external.every((i) => isFamilyHref(i.href))).toBe(true);
  });

  it("keeps no /docs/setup or /docs/packages route (they redirect to the handbook)", () => {
    expect(DOCS_PAGES.filter((p) => /^\/docs\/(setup|packages)(\/|$)/.test(p.href))).toEqual([]);
  });

  it("pages only through Studio's own pages", () => {
    expect(DOCS_PAGES.some(isExternalItem)).toBe(false);
    const last = docsPager("/docs/captioning/prose-enrichment/");
    expect(last.current?.label).toBe("Prose enrichment");
    expect(last.next).toBeNull();
    expect(docsPager(`${HANDBOOK_ORIGIN}/setup/`).current).toBeNull();
  });
});
