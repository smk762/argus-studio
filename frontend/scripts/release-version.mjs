// The version of a package at a `dev` commit, as setuptools-scm would write it
// (`0.15.0` at a tag, else `0.15.1.dev9+gf9aae0bbf`). Ported from
// argus-handbook's package-docs import (web/scripts/package-docs-lib.mjs), which
// labels the same commits; keep the two in step.
import { execFileSync } from "node:child_process";

/** `0.15.0` at the tag itself, else the next patch's dev release (`0.15.1.dev9+gf9aae0bbf`). */
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
 * @param {{ tag: string, commit: string, released: string[] }[]} tags newest first
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

/** The version at `commit` in the clone `git` runs in (a `--filter=blob:none` clone is enough). */
export function versionAt(git, commit) {
  const lines = git("tag", "--list", "v[0-9]*", "--sort=-v:refname", "--format=%(refname:short) %(*objectname) %(objectname)")
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean);
  const tags = lines.map((line) => {
    const [tag, peeled, object] = line.split(" ");
    const at = peeled || object; // an annotated tag peels to its commit
    const parents = git("rev-list", "--parents", "-n", "1", at).toString().trim().split(" ").slice(1);
    return { tag, commit: at, released: parents.length > 1 ? [at, parents[1]] : [at] };
  });
  const isAncestor = (c) => {
    try {
      git("merge-base", "--is-ancestor", c, commit);
      return true;
    } catch {
      return false;
    }
  };
  const found = releaseOf(tags, isAncestor);
  if (!found) throw new Error(`no v* release tag behind ${commit}`);
  const distance = Number(git("rev-list", "--count", `${found.base}..${commit}`).toString().trim());
  return versionFrom(found.tag, distance, git("rev-parse", "--short", commit).toString().trim());
}

/** A `git -C <dir>` runner. */
export const gitIn = (dir) => (...args) => execFileSync("git", ["-C", dir, ...args], { maxBuffer: 64 << 20 });
