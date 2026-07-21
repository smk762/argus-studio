/**
 * Posix path helpers for the paths the *curator/lens hosts* see on their
 * filesystems — not the browser's, and not URLs. Every function here assumes
 * `/` separators.
 */

/** Strip trailing slashes from a path root (posix), so joins don't double up. */
export function normalizeRoot(root: string): string {
  return root.replace(/\/+$/, "");
}

/**
 * Join a relative segment onto a root: the root's trailing slashes and the
 * segment's leading/trailing slashes are normalized so exactly one separator
 * sits between them.
 */
export function joinPath(root: string, segment: string): string {
  return `${normalizeRoot(root)}/${segment.replace(/^\/+|\/+$/g, "")}`;
}

/**
 * Last segment of a posix path, falling back to the whole path when there is
 * no separator or the result would be empty. Never returns undefined, so
 * callers can render it directly.
 */
export function basename(path: string): string {
  const segments = normalizeRoot(path).split("/");
  return segments[segments.length - 1] || path;
}
