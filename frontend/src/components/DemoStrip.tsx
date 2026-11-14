import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The Dragonhound Labs family bar (vendor/dh/dh-strip.html, styled by dh-strip.css),
 * first in <body> after the skip link. The markup is the vendored file itself, read
 * at build time, so a re-sync updates it with no edit here; the only change is
 * `aria-current` on Studio's link. Rendered by the root layout only when
 * STATIC_DEMO is set (the self-hosted build is not part of the family site). It is
 * plain HTML with no script, so the static export's hash CSP is unaffected.
 */
export function DemoStrip() {
  return <div className="contents" dangerouslySetInnerHTML={{ __html: stripHtml(readVendoredStrip()) }} />;
}

/** The vendored strip, comment dropped, with Studio's link marked current. */
export function stripHtml(raw: string): string {
  const html = raw.replace(/<!--[\s\S]*?-->\s*/g, "").trim();
  const marked = html.replace(/<a href="https:\/\/studio\.dragonhound\.dev\/">/, '<a href="https://studio.dragonhound.dev/" aria-current="true">');
  if (marked === html) throw new Error("dh-strip.html: Studio's link not found; check the vendored strip");
  return marked;
}

function readVendoredStrip(): string {
  return readFileSync(join(process.cwd(), "vendor/dh/dh-strip.html"), "utf8");
}
