/**
 * The Packages section of /docs (argus-studio#170): which package docs are
 * imported, at which `dev` commit, and where each one lives on this site. It
 * reads the sync record (`schema/docs.json`, written by `npm run docs:pull`),
 * so the routes, the nav and the record cannot disagree.
 *
 * Client-safe: no file reads here (those are in packageDocsRender.ts, on the
 * server), so the docs nav, breadcrumb and pager can use it too.
 */
import record from "../../schema/docs.json";

export interface PackageDocPage {
  /** The path in the package's repo. */
  file: string;
  /** The route under /docs/packages/<short>: "" for the README. */
  slug: string;
  title: string;
}

export interface PackageDocs {
  /** The route segment: "lens", "curator", ... */
  short: string;
  /** The PyPI and repo name: "argus-lens". */
  package: string;
  /** owner/name on GitHub. */
  repo: string;
  branch: string;
  commit: string;
  version: string;
  pages: PackageDocPage[];
  /** Allowlisted files held back because they fail the opsec gate at this commit. */
  held: string[];
  /** Every imported file (docs and vendored images), by path under frontend/, with its sha256. */
  files: Record<string, string>;
}

type RecordEntry = Omit<PackageDocs, "short">;

export const PACKAGE_DOCS: PackageDocs[] = Object.entries(
  (record as unknown as { packages: Record<string, RecordEntry> }).packages,
).map(([short, entry]) => ({ short, ...entry }));

export const packageDocs = (short: string): PackageDocs | undefined => PACKAGE_DOCS.find((pkg) => pkg.short === short);

/** The package's README page, or a sub-page by slug, with an optional `#anchor`. */
export const packageHref = (short: string, slug = "", anchor?: string): string =>
  `/docs/packages/${short}${slug ? `/${slug}` : ""}${anchor ? `#${anchor}` : ""}`;

/** Every page but the README's: listed on the package page, not in the sidebar. */
export const subPages = (pkg: PackageDocs): PackageDocPage[] => pkg.pages.filter((page) => page.slug !== "");

export const shortSha = (commit: string): string => commit.slice(0, 7);

/** Off-site links for a package, pinned to the recorded commit. */
export function packageLinks(pkg: Pick<PackageDocs, "repo" | "commit" | "package">) {
  return {
    source: `https://github.com/${pkg.repo}/tree/${pkg.commit}`,
    blob: (path: string) => `https://github.com/${pkg.repo}/blob/${pkg.commit}/${path}`,
    changelog: `https://github.com/${pkg.repo}/blob/${pkg.commit}/CHANGELOG.md`,
    pypi: `https://pypi.org/project/${pkg.package}/`,
  };
}

/** The imported page a repo file is, by package repo name ("argus-lens") and path, for on-site links. */
export function importedPage(repoName: string, path: string): { pkg: PackageDocs; page: PackageDocPage } | null {
  const pkg = PACKAGE_DOCS.find((candidate) => candidate.repo.split("/")[1] === repoName);
  const page = pkg?.pages.find((candidate) => candidate.file === path);
  return pkg && page ? { pkg, page } : null;
}
