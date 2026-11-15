// Bombadil specification for the static demo export (argus-studio#241, epic #240).
//
// Bombadil drives a real browser around `out/` (from `npm run build:static`) at
// random (clicks, typing, scrolling, back/reload and viewport resizes) and
// checks every property below in each state it reaches. CI runs it on every
// PR (.github/workflows/ci.yml, job `bombadil`); locally:
//
//   npm run build:static && node scripts/static-server.mjs out --port=4173 &
//   docker run --rm --network host -v "$PWD":/w -w /w antithesishq/bombadil:0.7.10 \
//     browser test --headless --no-sandbox --time-limit 3m --output-path /w/bombadil-output \
//     http://127.0.0.1:4173/ bombadil/spec.ts
//
// (or `npx bombadil browser test …`: the devDependency carries the Linux and
// macOS arm64 binaries; it needs a local Chrome.)
//
// A violation exits 2 and prints a `--reproduce` command; `bombadil browser
// inspect bombadil-output` steps through the trace. Only point this at the
// static export or a read-only deployment: random clicks will press any
// delete, purge or move button a live backend offers.
//
// Extractors run inside the page, so each one must be self-contained (no
// module-scope helpers) and return JSON.
//
// Leave out the resource-leak extras (`noResourceLeak`): Bombadil reads
// Chrome's node and listener counts without forcing a GC, so React's
// short-lived garbage trips any useful threshold (findings on #242).

import { always, eventually, now } from "@antithesishq/bombadil";
import { actions, extract, weighted } from "@antithesishq/bombadil/browser";
import { defaultActions } from "@antithesishq/bombadil/browser/defaults";

// Uncaught exceptions, unhandled rejections, console errors (which include CSP
// violation reports) and HTTP 4xx/5xx: a static export should produce none.
export {
  noConsoleErrors,
  noHttpErrorCodes,
  noUncaughtExceptions,
  noUnhandledPromiseRejections,
} from "@antithesishq/bombadil/browser/defaults/properties";

const page = extract((state) => {
  const doc = state.document;
  const root = doc.documentElement;
  const dhTheme = (state.window as Window & { dhTheme?: { effective(): string } }).dhTheme;
  const effective = dhTheme ? dhTheme.effective() : null;
  const path = state.window.location.pathname;
  const text = doc.body ? doc.body.innerText : "";
  return {
    path,
    mains: doc.querySelectorAll("main").length,
    h1s: doc.querySelectorAll("h1").length,
    headerBadges: doc.querySelectorAll("header .dh-badge").length,
    overflowX: root.scrollWidth - root.clientWidth,
    themeAttr: root.getAttribute("data-theme"),
    effective,
    togglesInStep: Array.from(doc.querySelectorAll("[data-dh-theme-toggle]")).every(
      (button) => button.getAttribute("aria-pressed") === String(effective === "dark"),
    ),
    unreachable: !path.startsWith("/docs/") && /\bunreachable\b/i.test(text),
    loading: /\bLoading(…|\.\.\.)/.test(text),
  };
});

// dh-theme.js: exactly one of light or dark is applied. `data-theme` is a
// stored override or unset (follow the system), never anything else.
export const themeIsLightOrDark = always(
  () => (page.current.effective === "light" || page.current.effective === "dark") && [null, "light", "dark"].includes(page.current.themeAttr),
);

// Every toggle's aria-pressed follows the theme (pressed = dark), including
// toggles React mounts after a client-side navigation, once dh-theme.js has
// had a moment to see them.
export const themeToggleInStep = always(
  now(() => !page.current.togglesInStep).implies(eventually(() => page.current.togglesInStep).within(1, "seconds")),
);

// A nav link never leads to a page without its one <main> landmark.
export const oneMainLandmark = always(() => page.current.mains === 1);

// One page title for the heading outline.
export const atMostOneH1 = always(() => page.current.h1s <= 1);

// CLAUDE.md: one demo-state badge per page, in the header.
export const atMostOneHeaderBadge = always(() => page.current.headerBadges <= 1);

// The page body never scrolls sideways at the current viewport (check-overflow.mjs
// covers each route once at 390px; this holds across interactions and resizes).
// A state captured straight after a resize can catch the layout mid-reflow (the
// first CI run saw 5px at 362px that no settled layout reproduces), so overflow
// fails only when it is still there a second later.
export const noHorizontalScroll = always(
  now(() => page.current.overflowX > 1).implies(eventually(() => page.current.overflowX <= 1).within(1, "seconds")),
);

// CLAUDE.md: a page in the static demo renders recorded data, never a
// backend "unreachable" state...
export const staticDemoNeverUnreachable = always(() => !page.current.unreachable);

// ...and never sits on a spinner.
export const loadingSettles = always(
  now(() => page.current.loading).implies(eventually(() => !page.current.loading).within(5, "seconds")),
);

// Bombadil's default actions, plus an occasional resize between a small phone
// and a desktop, so the layout properties see more than the 1024px default.
const resize = actions(() => [{ SetViewport: { width: [360, 1280], height: [640, 900] } }]);

export const studioActions = weighted([
  [95, defaultActions],
  [5, resize],
]);
