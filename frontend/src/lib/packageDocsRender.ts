/**
 * A package's imported doc (src/content/packages/<short>/, see
 * scripts/package-docs.mjs) turned into a page at render time on the server.
 * Nothing is fetched at runtime and nothing is injected as HTML: the markdown
 * becomes React elements (react-markdown, no rehype-raw), so the page needs no
 * CSP source it does not already have. Ported from argus-cull's src/lib/docs.ts.
 *
 * The transforms, in one remark pass:
 * - the first `#` title goes (the page shows it in its own header); a later `#` renders as a section;
 * - every heading gets GitHub's id, counted over the whole file, so a deep link means what it means on GitHub;
 * - a link to an imported doc (this package's or a sibling's) stays on this site; any other file in the
 *   package's repo goes to GitHub at the recorded commit, and `../<sibling>/...` to that sibling's `dev`;
 * - an image from the package's own repo loads from the vendored copy under /package-docs/<short>/;
 *   any other remote image (badges) is dropped, so `img-src` needs nothing new.
 * Raw HTML is skipped by the renderer.
 */
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";

import type { Heading, Image, Link, Nodes, Root } from "mdast";

import { repoImagePath } from "../../scripts/package-docs-lib.mjs";
import { importedPage, packageHref, packageLinks, type PackageDocPage, type PackageDocs } from "./packageDocs";

/** Where the imported files sit, relative to the frontend (the build's and the server's working directory). */
export const PACKAGE_CONTENT = join("src", "content", "packages");

export function readPackageDoc(pkg: PackageDocs, page: PackageDocPage): string {
  return readFileSync(join(process.cwd(), PACKAGE_CONTENT, pkg.short, page.file), "utf8");
}

const textOf = (node: Nodes): string =>
  "value" in node && typeof node.value === "string"
    ? node.value
    : "children" in node
      ? (node.children as Nodes[]).map(textOf).join("")
      : "";

/** GitHub's heading ids (github-slugger): lower case, punctuation dropped, spaces to hyphens, repeats numbered. */
export function slugger() {
  const seen = new Map<string, number>();
  return (text: string): string => {
    const base = text
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
      .replace(/ /g, "-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

export interface DocHeading {
  depth: number;
  text: string;
  id: string;
}

const isRemote = (url: string) => /^[a-z][a-z0-9+.-]*:|^\/\//i.test(url);
const withAnchor = (url: string, anchor?: string) => `${url}${anchor ? `#${anchor}` : ""}`;
const GITHUB_FILE = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|tree)\/(?:main|dev)\/([^?#]+)(?:#(.*))?$/;

/** Every link resolved: on this site when it is an imported doc, else GitHub (the recorded commit for this repo, `dev` for a sibling). */
export function resolveLink(url: string, pkg: PackageDocs, page: PackageDocPage): string {
  if (url.startsWith("#")) return url;
  const owner = pkg.repo.split("/")[0];
  if (isRemote(url)) {
    // A GitHub link to an imported doc at main or dev reads the same page here.
    const found = GITHUB_FILE.exec(url);
    if (found && found[1] === owner) {
      const hit = importedPage(found[2], posix.normalize(decodeURI(found[3])));
      if (hit) return packageHref(hit.pkg.short, hit.page.slug, found[4]);
    }
    return url;
  }
  const [path, anchor] = url.split("#", 2);
  // GitHub reads a leading `/` as the repo's root.
  const target = posix.normalize(path.startsWith("/") ? path.slice(1) : posix.join(posix.dirname(page.file), decodeURI(path)));
  if (target.startsWith("../")) {
    // A sibling repo in the suite's checkout layout: `../argus-lens/README.md`.
    const [repo, ...rest] = target.slice(3).split("/");
    const hit = importedPage(repo, rest.join("/"));
    if (hit) return packageHref(hit.pkg.short, hit.page.slug, anchor);
    return withAnchor(`https://github.com/${owner}/${repo}/blob/dev/${rest.join("/")}`, anchor);
  }
  const own = pkg.pages.find((candidate) => candidate.file === target);
  if (own) return packageHref(pkg.short, own.slug, anchor);
  return withAnchor(packageLinks(pkg).blob(target === "." ? "" : target), anchor);
}

/** The vendored copy of an image from the package's own repo, or null to drop it. */
export function resolveImage(src: string, pkg: PackageDocs, page: PackageDocPage): string | null {
  const path: string | null = repoImagePath(pkg, page.file, src);
  if (!path) return null;
  const vendored = `public/package-docs/${pkg.short}/${path}`;
  return vendored in pkg.files ? `/package-docs/${pkg.short}/${path}` : null;
}

function walk(node: Nodes, visit: (node: Nodes, parent: Nodes | null) => void, parent: Nodes | null = null) {
  visit(node, parent);
  if ("children" in node) for (const child of [...(node.children as Nodes[])]) walk(child, visit, node);
}

const remove = (node: Nodes, parent: Nodes) => {
  const siblings = (parent as { children: Nodes[] }).children;
  siblings.splice(siblings.indexOf(node), 1);
};

/** The remark plugin for one page. Collects the headings it kept, for the anchor tests. */
export function packageDoc(pkg: PackageDocs, page: PackageDocPage) {
  const headings: DocHeading[] = [];
  const plugin = () => (tree: Root) => {
    const slug = slugger();
    const ids = new Map<Heading, string>();
    walk(tree, (node) => {
      if (node.type === "heading") ids.set(node, slug(textOf(node)));
    });
    // The title is the first heading when it is a `#` one (a README that opens with an HTML logo has none).
    const first = tree.children.findIndex((node) => node.type === "heading");
    if (first >= 0 && (tree.children[first] as Heading).depth === 1) tree.children.splice(first, 1);

    walk(tree, (node) => {
      if (node.type !== "heading") return;
      const id = ids.get(node)!;
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
      headings.push({ depth: node.depth, text: textOf(node), id });
    });

    walk(tree, (node, parent) => {
      if (node.type === "link" || node.type === "definition") (node as Link).url = resolveLink(node.url, pkg, page);
      if (node.type === "image" && parent) {
        const image = node as Image;
        const src = resolveImage(image.url, pkg, page);
        if (src) image.url = src;
        else remove(node, parent);
      }
    });
    // A badge's link is empty once its image is gone.
    walk(tree, (node, parent) => {
      if (node.type === "link" && node.children.length === 0 && parent) remove(node, parent);
    });
  };
  return { plugin, headings };
}

/** The page's headings, worked out before it renders, for the anchor tests. */
export async function packageDocHeadings(pkg: PackageDocs, page: PackageDocPage, markdown: string = readPackageDoc(pkg, page)): Promise<DocHeading[]> {
  const [{ unified }, { default: remarkParse }, { default: remarkGfm }] = await Promise.all([
    import("unified"),
    import("remark-parse"),
    import("remark-gfm"),
  ]);
  const doc = packageDoc(pkg, page);
  const processor = unified().use(remarkParse).use(remarkGfm).use(doc.plugin);
  await processor.run(processor.parse(markdown));
  return doc.headings;
}
