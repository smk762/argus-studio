/**
 * argus-handbook (docs.dragonhound.dev) owns the suite-wide docs: the setup
 * guides and each package's own docs. They used to live under Studio's /docs;
 * Studio keeps only its captioning concepts and redirects the old paths.
 *
 * The one list of moved prefixes. `next.config.ts` builds the server build's
 * redirects from it, and `handbook.test.ts` holds `public/_redirects` (the
 * static demo's, on Cloudflare Pages) to the same list.
 */
export const HANDBOOK_ORIGIN = "https://docs.dragonhound.dev";

/** Each `/docs/<prefix>/…` path now lives at `${HANDBOOK_ORIGIN}/<prefix>/…`. */
export const HANDBOOK_MOVED = ["setup", "packages"] as const;

/** A handbook URL; `path` without a leading slash, e.g. `packages/lens/cli/`. */
export const handbookUrl = (path = ""): string => `${HANDBOOK_ORIGIN}/${path}`;

/** The server build's 301s (Next `permanent: true` answers 308) for every moved prefix. */
export function handbookRedirects(): { source: string; destination: string; permanent: true }[] {
  return HANDBOOK_MOVED.map((prefix) => ({
    source: `/docs/${prefix}/:path*`,
    destination: `${HANDBOOK_ORIGIN}/${prefix}/:path*`,
    permanent: true,
  }));
}
