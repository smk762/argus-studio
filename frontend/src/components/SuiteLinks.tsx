import { cullUrl, lightboxUrl, safelightUrl, sightlineUrl } from "@/lib/curatorEnv";
import { suiteLinks } from "@/lib/suiteLinks";

/** Footer links to the standalone demo UIs. Renders nothing until a deployment configures one. */
export function SuiteLinks() {
  const links = suiteLinks({ lightbox: lightboxUrl(), cull: cullUrl(), safelight: safelightUrl(), sightline: sightlineUrl() });
  if (links.length === 0) return null;
  return (
    <nav aria-label="Standalone demos" className="mx-auto flex max-w-7xl flex-wrap gap-x-4 gap-y-1 px-4 pb-2 text-xs text-muted sm:px-6">
      <span>Standalone demos:</span>
      {links.map((link) => (
        <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="text-accent-purple transition-colors hover:text-accent-purple/80">
          {link.label} <span className="text-muted">({link.service})</span>
        </a>
      ))}
    </nav>
  );
}
