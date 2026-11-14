/** The Dragonhound Labs family: dragonhound.dev and every subdomain (studio., lightbox., realms.). */
export const FAMILY_DOMAIN = "dragonhound.dev";

/**
 * True when `href` points at a dragonhound.dev host. Those links are internal to
 * the family and open in the same tab (dh-shared README, "Demo strip"); anything
 * else off-site opens a new tab. Relative hrefs are not family links: they are
 * same-site routes and go through next/link.
 */
export function isFamilyHref(href: string | undefined): boolean {
  if (!href) return false;
  let host: string;
  try {
    host = new URL(href).hostname;
  } catch {
    return false;
  }
  return host === FAMILY_DOMAIN || host.endsWith(`.${FAMILY_DOMAIN}`);
}
