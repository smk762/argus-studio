import { Children, isValidElement, type ReactNode } from "react";

/**
 * GitHub-style slug: lower-case, spaces to hyphens, punctuation stripped.
 * Keeps Unicode letters/digits (via `\p{L}`/`\p{N}` + the `u` flag) so a
 * non-ASCII heading like `## 概要` yields a real anchor instead of collapsing
 * to an empty id. Note: this does NOT de-duplicate repeated headings — two
 * headings that slug alike on one page still collide (see rehype-slug for a
 * build-time counter).
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Flatten a React node to its visible text — enough to slug a heading whose
 * children may include inline `<code>`/emphasis, not just a bare string. Used
 * to give MDX headings stable ids that the on-page TOC can anchor to, without
 * pulling in a rehype plugin (Turbopack serialises those as module names only).
 */
export function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement(node)) {
    return nodeText((node.props as { children?: ReactNode }).children);
  }
  return Children.toArray(node).map(nodeText).join("");
}
