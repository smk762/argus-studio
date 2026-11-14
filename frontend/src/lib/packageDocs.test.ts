import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DOCS_PAGES, docsPager } from "@/components/docs/docsNav";
import { PackageReadme, PackageSubPage } from "@/components/docs/PackageDoc";

import { PACKAGES, releaseOf, slugOf, titleOf, versionFrom, versionOf } from "../../scripts/package-docs-lib.mjs";
import { check, RECORD_PATH } from "../../scripts/package-docs.mjs";
import { opsecFindings } from "./docsOpsec";
import { PACKAGE_DOCS, packageDocs, packageHref, subPages, type PackageDocPage, type PackageDocs } from "./packageDocs";
import { packageDoc, packageDocHeadings, readPackageDoc, resolveLink, slugger } from "./packageDocsRender";

const record = JSON.parse(readFileSync(RECORD_PATH, "utf8"));

/** Every route the section has, with its rendered markup. */
const rendered = new Map<string, string>();
for (const pkg of PACKAGE_DOCS) {
  rendered.set(packageHref(pkg.short), renderToStaticMarkup(createElement(PackageReadme, { pkg })));
  for (const page of subPages(pkg)) {
    rendered.set(packageHref(pkg.short, page.slug), renderToStaticMarkup(createElement(PackageSubPage, { pkg, page })));
  }
}
const idsOn = (route: string) => new Set([...rendered.get(route)!.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

/** Fails unless `href` is a package route that exists and, with an anchor, a heading on it. */
function expectLands(href: string, from: string) {
  const [path, anchor] = href.split("#");
  expect(rendered.has(path), `${from} links ${href}: no such page`).toBe(true);
  if (anchor) expect(idsOn(path), `${from} links ${href}: no #${anchor} on ${path}`).toContain(anchor);
}

const allPages = PACKAGE_DOCS.flatMap((pkg) => pkg.pages.map((page) => [pkg, page] as [PackageDocs, PackageDocPage]));

describe("the package docs registry", () => {
  it("lists the import script's packages, allowlists and held files, in nav order", () => {
    expect(PACKAGE_DOCS.map((pkg) => pkg.short)).toEqual(PACKAGES.map((pkg) => pkg.short));
    for (const pkg of PACKAGES) {
      const entry = packageDocs(pkg.short)!;
      expect(entry.package).toBe(pkg.package);
      expect(entry.repo).toBe(pkg.repo);
      expect(entry.branch).toBe("dev");
      expect(entry.pages.map((page) => page.file)).toEqual(pkg.docs);
      expect(entry.held).toEqual(pkg.held ?? []);
      for (const page of entry.pages) {
        expect(page.slug).toBe(slugOf(page.file));
        expect(page.title).toBe(titleOf(pkg, page.file, readPackageDoc(entry, page)));
      }
    }
  });

  it("never imports agent, planning or notebook files", () => {
    for (const pkg of PACKAGES) {
      for (const file of pkg.docs) {
        expect(file).toMatch(/^(README\.md|DESIGN\.md|spec\.md|docs\/[a-z0-9-]+\.md)$/);
        expect(file).not.toMatch(/CLAUDE|AGENTS|TODO|\.claude|(^|\/)first-bake\.md$|notebook/i);
      }
    }
  });

  it("has unique routes", () => {
    for (const pkg of PACKAGE_DOCS) {
      const slugs = pkg.pages.map((page) => page.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("matches the committed files (docs:check passes, offline)", async () => {
    expect(await check(record, [])).toEqual([]);
  });

  it("records a full dev commit and a version for every package", () => {
    for (const pkg of PACKAGE_DOCS) {
      expect(pkg.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(pkg.version).toMatch(/^\d+\.\d+/);
    }
  });
});

describe("versionOf", () => {
  it("renders git describe as setuptools-scm does", () => {
    expect(versionOf("v0.15.0-0-gf9aae0bbf")).toBe("0.15.0");
    expect(versionOf("v0.15.0-9-gf9aae0bbf\n")).toBe("0.15.1.dev9+gf9aae0bbf");
    expect(versionOf("v0.3.0a1-3-g77cc8fd")).toBe("0.3.0a2.dev3+g77cc8fd");
  });
});

describe("the imported pages", () => {
  it.each(allPages.map(([pkg, page]) => [`${pkg.short}/${page.file}`, pkg, page] as const))(
    "%s has a heading for its title, and ids on the rest",
    async (_, pkg, page) => {
      const markdown = readPackageDoc(pkg, page);
      // A README is titled by its package; any other page by its own `#` heading.
      if (page.file !== "README.md") expect(markdown).toMatch(/^# \S/m);
      expect(page.title.length).toBeGreaterThan(0);
      const headings = await packageDocHeadings(pkg, page, markdown);
      for (const heading of headings) expect(idsOn(packageHref(pkg.short, page.slug)), heading.text).toContain(heading.id);
    },
  );

  it("number repeated headings as GitHub does", () => {
    const slug = slugger();
    expect(["Why not FiftyOne / fastdup / Immich?", "HTTP API (:8101)", "Filters", "Filters", "`argus-lens caption`"].map(slug)).toEqual([
      "why-not-fiftyone--fastdup--immich",
      "http-api-8101",
      "filters",
      "filters-1",
      "argus-lens-caption",
    ]);
  });

  it("render without a style attribute, raw HTML, a script or a remote image, so the CSP needs nothing new", () => {
    for (const [route, markup] of rendered) {
      expect(markup, route).not.toMatch(/\sstyle="/);
      expect(markup, route).not.toMatch(/<script|<iframe|<picture|<img[^>]+src="(?:https?:)?\/\//);
    }
  });

  it("show the version, the short sha and the PyPI, source and changelog links", () => {
    for (const pkg of PACKAGE_DOCS) {
      const markup = rendered.get(packageHref(pkg.short))!;
      expect(markup).toContain(`${pkg.package} ${pkg.version} @ ${pkg.commit.slice(0, 7)}`);
      expect(markup).toContain(`href="https://pypi.org/project/${pkg.package}/"`);
      expect(markup).toContain(`href="https://github.com/${pkg.repo}/tree/${pkg.commit}"`);
      expect(markup).toContain(`href="https://github.com/${pkg.repo}/blob/${pkg.commit}/CHANGELOG.md"`);
      expect(markup).toMatch(/target="_blank" rel="noopener noreferrer"/);
    }
  });

  it("list a package's other pages on its page, and its held files", () => {
    for (const pkg of PACKAGE_DOCS) {
      const markup = rendered.get(packageHref(pkg.short))!;
      for (const page of subPages(pkg)) expect(markup).toContain(`href="${packageHref(pkg.short, page.slug)}"`);
      for (const file of pkg.held) expect(markup).toContain(`href="https://github.com/${pkg.repo}/blob/${pkg.commit}/${file}"`);
    }
  });

  it("drop the title heading", () => {
    for (const [pkg, page] of allPages) {
      const markup = renderToStaticMarkup(createElement(PackageSubPage, { pkg, page }));
      expect(markup.match(/<h1/g)?.length, `${pkg.short}/${page.file}`).toBe(1);
    }
  });

  it("show vendored images from the package's own repo", () => {
    const atlas = packageDocs("atlas")!;
    const vendored = Object.keys(atlas.files).filter((path) => path.startsWith("public/"));
    expect(vendored.length).toBeGreaterThan(0);
    const markup = [...rendered].filter(([route]) => route.startsWith("/docs/packages/atlas")).map(([, html]) => html).join("");
    for (const path of vendored) expect(markup).toContain(`src="${path.slice("public".length)}"`);
  });

  it("pass the opsec gate as rendered", () => {
    for (const [route, markup] of rendered) expect(opsecFindings(markup), route).toEqual([]);
  });

  it("emit only in-site links that land on a page and a heading", () => {
    for (const [route, markup] of rendered) {
      for (const [, href] of markup.matchAll(/href="(\/docs\/packages\/[^"]*)"/g)) expectLands(href.replace(/&amp;/g, "&"), route);
    }
  });
});

describe("links into the package docs from Studio's own pages", () => {
  const ROOT = join(__dirname, "..");
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (p === join(ROOT, "content", "packages")) return [];
      if (statSync(p).isDirectory()) return sources(p);
      return /\.(mdx|ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [p] : [];
    });

  it("land on a page and a heading that exist", () => {
    let count = 0;
    for (const file of [...sources(join(ROOT, "app", "docs")), ...sources(join(ROOT, "content"))]) {
      for (const m of readFileSync(file, "utf8").matchAll(/\]\((\/docs\/packages\/[^)\s]+)\)|href="(\/docs\/packages\/[^"]+)"/g)) {
        expectLands(m[1] ?? m[2], file);
        count++;
      }
    }
    // The four captioning concept pages each link lens's reference.
    expect(count).toBeGreaterThanOrEqual(4);
  });
});

describe("link resolution", () => {
  const curator = packageDocs("curator")!;
  const page = curator.pages.find((candidate) => candidate.file === "docs/nudity.md")!;

  it("keeps an imported doc on this site, its own or a sibling's", () => {
    expect(resolveLink("policy-check.md#modes", curator, page)).toBe("/docs/packages/curator/policy-check#modes");
    expect(resolveLink("../README.md", curator, page)).toBe("/docs/packages/curator");
    expect(resolveLink("../../argus-lens/README.md", curator, page)).toBe("/docs/packages/lens");
    expect(resolveLink("https://github.com/smk762/argus-lens/blob/main/docs/cli.md#argus-lens-caption", curator, page)).toBe(
      "/docs/packages/lens/cli#argus-lens-caption",
    );
  });

  it("sends other repo files to GitHub at the recorded commit, and siblings to dev", () => {
    expect(resolveLink("../DESIGN.md#x", curator, page)).toBe(`https://github.com/${curator.repo}/blob/${curator.commit}/DESIGN.md#x`);
    expect(resolveLink("../../argus-mask/docs/x.md", curator, page)).toBe("https://github.com/smk762/argus-mask/blob/dev/docs/x.md");
    expect(resolveLink("#local", curator, page)).toBe("#local");
    expect(resolveLink("https://example.org/a", curator, page)).toBe("https://example.org/a");
  });

  it("drops badges and their empty links", async () => {
    const [{ unified }, { default: remarkParse }] = await Promise.all([import("unified"), import("remark-parse")]);
    const doc = packageDoc(curator, page);
    const processor = unified().use(remarkParse).use(doc.plugin);
    const tree = await processor.run(processor.parse("# T\n\n[![CI](https://img.shields.io/x.svg)](https://ci) text\n"));
    expect(JSON.stringify(tree)).not.toMatch(/shields|"type":"link"/);
  });
});

describe("the docs nav", () => {
  it("has one Packages entry per package, with its pages as children", () => {
    const hrefs = DOCS_PAGES.map((page) => page.href);
    for (const pkg of PACKAGE_DOCS) {
      expect(hrefs).toContain(packageHref(pkg.short));
      for (const page of subPages(pkg)) expect(hrefs).toContain(packageHref(pkg.short, page.slug));
    }
  });

  it("pages through a package and crumbs back to it", () => {
    const lens = packageDocs("lens")!;
    const [first, second] = subPages(lens);
    const { current, prev, next } = docsPager(`${packageHref("lens", first.slug)}/`);
    expect(current?.section).toBe("Packages");
    expect(current?.parent?.href).toBe(packageHref("lens"));
    expect(prev?.href).toBe(packageHref("lens"));
    expect(next?.href).toBe(packageHref("lens", second.slug));
  });
});

describe("releaseOf", () => {
  // dev: a1 <- a2 <- a3 (HEAD). v0.2.0 is a merge on main whose second parent is a2.
  const history = new Set(["a1", "a2", "a3"]);
  const isAncestor = (c: string) => history.has(c);

  it("counts a release tagged on a merge into main by its second parent", () => {
    const tags = [
      { tag: "v0.2.0", commit: "m1", released: ["m1", "a2"] },
      { tag: "v0.1.1", commit: "a1", released: ["a1"] },
    ];
    expect(releaseOf(tags, isAncestor)).toEqual({ tag: "v0.2.0", base: "a2" });
  });

  it("falls back to an older tag in dev's own history", () => {
    const tags = [
      { tag: "v0.3.0", commit: "m9", released: ["m9", "z9"] },
      { tag: "v0.1.1", commit: "a1", released: ["a1"] },
    ];
    expect(releaseOf(tags, isAncestor)).toEqual({ tag: "v0.1.1", base: "a1" });
  });

  it("returns null with no release behind the commit", () => {
    expect(releaseOf([{ tag: "v9.0.0", commit: "x", released: ["x"] }], isAncestor)).toBeNull();
  });
});

describe("versionFrom", () => {
  it("is the tag itself at distance 0, else the next patch's dev release", () => {
    expect(versionFrom("v0.2.0", 0, "abc1234")).toBe("0.2.0");
    expect(versionFrom("v0.2.0", 25, "44e7e6b00")).toBe("0.2.1.dev25+g44e7e6b00");
  });
});
