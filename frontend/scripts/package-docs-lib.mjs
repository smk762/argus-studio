// The registry and pure helpers behind /docs/packages (argus-studio#170), shared
// by scripts/package-docs.mjs (the import) and src/lib/packageDocs.ts (the
// render), so a route, title or image path is worked out one way only. No I/O.
import { posix } from "node:path";

/**
 * The packages, in the order the docs nav lists them, each with its allowlist:
 * the README, the `docs/*.md` pages, and a top-level design doc where the
 * package keeps one there instead. Never agent or planning files (CLAUDE.md,
 * AGENTS.md, TODO.md, anything under .claude) and never lab notebooks.
 *
 * `held` lists files that belong on the allowlist but fail the opsec gate at
 * the recorded commit. They are not imported (the package page says so and
 * links them on GitHub); `docs:pull` still gates them and says when one passes,
 * so it can move back to `docs` once the fix lands in the package's dev branch.
 */
export const PACKAGES = [
  {
    short: "lens",
    package: "argus-lens",
    repo: "smk762/argus-lens",
    docs: ["README.md", "docs/cli.md", "docs/caption-result.md"],
    // The generated CLI reference is titled with the bare command name.
    titles: { "docs/cli.md": "CLI reference" },
  },
  {
    short: "curator",
    package: "argus-curator",
    repo: "smk762/argus-curator",
    docs: [
      "README.md",
      "docs/scoring.md",
      "docs/face-attributes.md",
      "docs/face-sources.md",
      "docs/scene-tags.md",
      "docs/garments.md",
      "docs/nudity.md",
      "docs/policy-check.md",
      "docs/moderation.md",
      "docs/prefilter.md",
      "docs/crops.md",
      "docs/sidecars.md",
      "docs/xmp.md",
      "docs/manifest.md",
      "docs/synthetic-face-sets.md",
      "docs/http-api.md",
      "docs/cli.md",
      "docs/gpu.md",
    ],
  },
  // DESIGN.md is quarry's design doc (status, rationale, where the build diverged), its only page beyond the README.
  // Held (2026-11-14): README.md names host mount paths (fix: smk762/argus-quarry#36).
  { short: "quarry", package: "argus-quarry", repo: "smk762/argus-quarry", docs: ["DESIGN.md"], held: ["README.md"] },
  // Held (2026-11-14): README.md names a host mount path.
  { short: "forge", package: "argus-forge", repo: "smk762/argus-forge", docs: [], held: ["README.md"] },
  { short: "proof", package: "argus-proof", repo: "smk762/argus-proof", docs: ["README.md"] },
  {
    short: "atlas",
    package: "argus-atlas",
    repo: "smk762/argus-atlas",
    docs: [
      "README.md",
      "docs/your-first-bake.md",
      "docs/styles.md",
      "docs/relief.md",
      "docs/data-sources.md",
      "docs/alignment-gate.md",
      "docs/chunks-and-mosaic.md",
      "docs/cli.md",
    ],
  },
  // spec.md is darkroom's design doc.
  { short: "darkroom", package: "argus-darkroom", repo: "smk762/argus-darkroom", docs: ["README.md", "spec.md"] },
  // SUITE.md is left out: it is the suite map written for agents (every repo's CLAUDE.md imports it).
  { short: "cortex", package: "argus-cortex", repo: "smk762/argus-cortex", docs: ["README.md"] },
];

export const BRANCH = "dev";

/** The route under /docs/packages/<short>: "" for the README, else the file's name, lower case, without `.md`. */
export const slugOf = (file) => (file === "README.md" ? "" : posix.basename(file, ".md").toLowerCase());

/** The page's title: the package name for the README, an override in `titles`, else its first `#` heading outside a code fence. */
export function titleOf(pkg, file, markdown) {
  if (file === "README.md") return pkg.package;
  if (pkg.titles?.[file]) return pkg.titles[file];
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    else if (!fenced && /^# /.test(line)) return line.slice(2).replace(/`/g, "").trim();
  }
  return slugOf(file);
}

/**
 * The version at `describe` (`git describe --tags --long`), as setuptools-scm
 * renders it: the tag itself on a tagged commit, else the tag's last number
 * bumped plus `.devN+g<sha>` (v0.15.0-9-gf9aae0bbf -> 0.15.1.dev9+gf9aae0bbf).
 */
export function versionOf(describe) {
  const found = /^v?(.+)-(\d+)-g([0-9a-f]+)$/.exec(describe.trim());
  if (!found) throw new Error(`cannot read a version from \`git describe\` output ${JSON.stringify(describe)}`);
  const [, tag, distance, sha] = found;
  return versionFrom(tag, Number(distance), sha);
}

/** `0.15.0` at the tag itself, else the next patch's dev release (`0.15.1.dev9+gf9aae0bbf`), as setuptools-scm writes it. */
export function versionFrom(tag, distance, sha) {
  const bare = tag.replace(/^v/, "");
  if (distance === 0) return bare;
  const bumped = bare.replace(/(\d+)(?!.*\d)/, (n) => String(Number(n) + 1));
  return `${bumped}.dev${distance}+g${sha}`;
}

/**
 * The release a `dev` commit builds on. `git describe` only sees tags in the
 * commit's own history, but a release cut as a reviewed PR from `dev` into a
 * protected `main` is tagged on the merge commit, which `dev` never contains
 * (argus-forge v0.2.0, argus-cortex v0.5.0). Such a tag still released the dev
 * commit that is its second parent. So a tag counts when its commit, or its
 * merge's second parent, is in the commit's history; the newest one wins.
 *
 * @param {{ tag: string, commit: string, released: string[] }[]} tags newest first; `released` = the commits it released (itself, and a merge's second parent)
 * @param {(ancestor: string) => boolean} isAncestor whether a commit is in the dev commit's history
 * @returns {{ tag: string, base: string } | null}
 */
export function releaseOf(tags, isAncestor) {
  for (const { tag, released } of tags) {
    const base = released.find((c) => isAncestor(c));
    if (base) return { tag, base };
  }
  return null;
}

const REMOTE = /^[a-z][a-z0-9+.-]*:|^\/\//i;

/**
 * Where an image src points inside the package's own repo, as a repo path, or
 * null for anything else. A relative src resolves against the doc's folder; a
 * raw.githubusercontent.com URL into the same repo (atlas links its figures at
 * `main` that way) is read at the recorded commit instead, since the page's
 * `img-src` should need no third-party origin. Other remote images (badges)
 * are null: the renderer drops them and nothing fetches them.
 */
export function repoImagePath(pkg, file, src) {
  const raw = `https://raw.githubusercontent.com/${pkg.repo}/`;
  if (src.startsWith(raw)) {
    const path = src.slice(raw.length).split(/[?#]/)[0].split("/").slice(1).join("/");
    return path ? posix.normalize(decodeURI(path)) : null;
  }
  if (REMOTE.test(src) || src.startsWith("/") || src.startsWith("#")) return null;
  const path = posix.normalize(posix.join(posix.dirname(file), decodeURI(src.split(/[?#]/)[0])));
  return path.startsWith("../") ? null : path;
}

/** Every image a doc shows from its own repo, as repo paths (markdown images only: raw HTML is never rendered). */
export function repoImages(pkg, file, markdown) {
  const found = new Set();
  for (const match of markdown.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    const path = repoImagePath(pkg, file, match[1]);
    if (path) found.add(path);
  }
  return [...found];
}

