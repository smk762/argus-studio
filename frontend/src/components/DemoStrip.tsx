import { strip } from "../../vendor/dh/dh-strip.mjs";

/**
 * The Dragonhound Labs family bar, rendered natively from the vendored
 * vendor/dh/dh-strip.mjs (the same source dh-strip.html is generated from, typed
 * by dh-strip.d.mts) and styled by dh-strip.css. First in <body> after the skip
 * link, so a re-sync updates links and labels with no edit here.
 *
 * `data-dh-site="studio"` lets dh-strip.css show Studio's link as current without
 * JS; aria-current is set here too, so it is in the static HTML and dh-theme.js
 * agrees with it. Rendered by the root layout only when STATIC_DEMO is set (the
 * self-hosted build is not part of the family site). No script, so the static
 * export's hash CSP is unaffected.
 */
export const STUDIO_SITE = "studio";

export function DemoStrip() {
  const { home } = strip;
  return (
    <nav className="dh-strip" aria-label={strip.ariaLabel} data-dh-site={STUDIO_SITE}>
      <a className="dh-strip-home" href={home.href} data-dh-site={home.site}>
        <svg className="dh-strip-mark" viewBox="0 0 100 100" width="18" height="18" aria-hidden="true" focusable="false">
          <path fillRule="evenodd" d={strip.markPath} />
        </svg>
        <span className="dh-strip-name">{home.label}</span>
      </a>
      <ul className="dh-strip-links">
        {strip.links.map((l) => (
          <li key={l.site}>
            <a href={l.href} data-dh-site={l.site} aria-current={l.site === STUDIO_SITE ? "page" : undefined}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="dh-strip-label">
        {strip.label}
        <span className="dh-strip-more">{strip.labelMore}</span>
      </p>
    </nav>
  );
}
