/**
 * Light/dark is the Dragonhound shared script, public/dh-theme.js (a copy of
 * vendor/dh/dh-theme.js; see dhShared.test.ts). It runs blocking in <head>, sets
 * `data-theme` on <html> before the first paint from a `dh-theme` cookie (Domain
 * .dragonhound.dev on the live hosts, so the choice follows you between the
 * family's sites), and handles clicks on any `[data-dh-theme-toggle]` button.
 *
 * Two states, system default: no `data-theme` means "follow prefers-color-scheme".
 * React only mirrors the effective scheme for the toggle's `aria-pressed`; it
 * never writes the theme itself.
 */

/** The scheme on screen now: the explicit `data-theme`, else the system's. */
export function effectiveScheme(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Server snapshot: unknown, rendered as not pressed until hydration reads the real one. */
export const serverScheme = (): "light" | "dark" => "light";

/** Calls `listener` when `data-theme` changes on <html> or the system scheme flips. */
export function subscribeScheme(listener: () => void): () => void {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", listener);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", listener);
  };
}
