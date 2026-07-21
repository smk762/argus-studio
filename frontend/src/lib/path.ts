/** Posix path helpers for joining dataset/export roots with relative locators. */

/** Strip trailing slashes from a path root (posix), so joins don't double up. */
export function normalizeRoot(root: string): string {
  return root.replace(/\/+$/, "");
}

/**
 * Join a relative segment onto a root: the root's trailing slashes and the
 * segment's leading/trailing slashes are normalized so exactly one separator
 * sits between them. Posix only — these paths are how the curator/lens hosts
 * see the filesystem, not the browser's.
 */
export function joinPath(root: string, segment: string): string {
  return `${normalizeRoot(root)}/${segment.replace(/^\/+|\/+$/g, "")}`;
}
