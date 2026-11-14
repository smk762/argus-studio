/*! dh-theme v1.0.0 | Dragonhound Labs light/dark theme, shared across *.dragonhound.dev.
 *
 * Load it as a plain, blocking script in <head>, before the stylesheet if you can:
 *     <meta name="color-scheme" content="light dark">
 *     <script src="/dh-theme.js"></script>
 * It is an external file with no inline code, so 'self' in script-src covers it under a hash- or
 * nonce-based CSP (and it creates no HTML, so Trusted Types is unaffected). Running in <head>
 * sets data-theme before first paint, so there is no flash of the wrong theme. It is ~1.5 KB.
 *
 * Model (two-state, system default): no stored value means "follow prefers-color-scheme".
 * Toggling stores an explicit override; toggling back to the system's own scheme clears it.
 * Storage: a "dh-theme" cookie on Domain=.dragonhound.dev (so the choice follows you between
 * dragonhound.dev, studio., lightbox., realms.), host-only on any other host (localhost, previews).
 * The cookie is set only when someone uses the toggle. A legacy localStorage "theme" value
 * (the landing page's old key) is read once and migrated.
 *
 * Toggle: any <button data-dh-theme-toggle> gets click handling and aria-pressed (pressed = dark).
 * Locked sites (e.g. a dark-only demo): <html data-theme="dark" data-dh-theme-lock> and the script
 * leaves the theme alone.
 * API: window.dhTheme = { get(), set("light" | "dark" | null) }.
 */
(() => {
  const KEY = "dh-theme", FAMILY = "dragonhound.dev", YEAR = 31536000;
  const root = document.documentElement;
  if (root.hasAttribute("data-dh-theme-lock")) return;
  const system = matchMedia("(prefers-color-scheme: dark)");
  const host = location.hostname;
  const domain = host === FAMILY || host.endsWith("." + FAMILY) ? "; Domain=." + FAMILY : "";
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const valid = (t) => (t === "light" || t === "dark" ? t : null);

  const readCookie = () => valid((document.cookie.match(/(?:^|;\s*)dh-theme=(light|dark)/) || [])[1]);
  const writeCookie = (t) => {
    document.cookie = KEY + "=" + (t || "") + "; Path=/; SameSite=Lax" + domain + secure + "; Max-Age=" + (t ? YEAR : 0);
  };
  const read = () => {
    const c = readCookie();
    if (c) return c;
    try { // one-time migration from the landing page's old localStorage key
      const old = valid(localStorage.getItem("theme"));
      localStorage.removeItem("theme");
      if (old) { writeCookie(old); return old; }
    } catch (e) { /* storage blocked */ }
    return null;
  };
  const effective = () => root.dataset.theme || (system.matches ? "dark" : "light");
  const sync = () => {
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.content = root.dataset.theme || "light dark";
    const pressed = String(effective() === "dark");
    document.querySelectorAll("[data-dh-theme-toggle]").forEach((b) => b.setAttribute("aria-pressed", pressed));
  };
  const apply = (t) => {
    t = valid(t);
    if (t) root.dataset.theme = t; else delete root.dataset.theme;
    sync();
  };
  const set = (t) => { t = valid(t); writeCookie(t); apply(t); };

  apply(read()); // before first paint

  const ready = () => {
    sync();
    document.addEventListener("click", (e) => {
      const btn = e.target instanceof Element && e.target.closest("[data-dh-theme-toggle]");
      if (!btn) return;
      const sys = system.matches ? "dark" : "light";
      const target = effective() === "dark" ? "light" : "dark";
      set(target === sys ? null : target);
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true });
  else ready();
  system.addEventListener("change", sync);
  // Another subdomain may have changed the cookie while this tab was in the background or bfcache.
  const recheck = () => { if (document.visibilityState === "visible") apply(readCookie()); };
  document.addEventListener("visibilitychange", recheck);
  addEventListener("pageshow", (e) => { if (e.persisted) apply(readCookie()); });

  window.dhTheme = { get: () => valid(root.dataset.theme), set };
})();
