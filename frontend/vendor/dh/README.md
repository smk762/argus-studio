# Dragonhound shared design layer (dh-shared v1)

The one source of truth for what the Dragonhound Labs sites share: dragonhound.dev (this repo,
the reference look), Studio, Lightbox and Realms. Each repo vendors a pinned copy, so there is no
runtime dependency and no CSP change. A checksum keeps the copies honest.

| File | What it is |
|---|---|
| `dh-tokens.css` | CSS custom properties, light and dark: colour, type, space, radius, elevation, focus, motion |
| `dh-badge.css` | The demo-state badge (`.dh-badge`), styled from the tokens |
| `dh-strip.html` + `dh-strip.css` | The family bar for the top of each demo (HTML + CSS, no JS) |
| `dh-theme.js` | Light/dark that follows you across `*.dragonhound.dev` (cookie), CSP-safe |
| `dh-mark.svg` | The logo mark, simplified for small sizes (1.2 KB; same shape as `src/data/logo.ts`) |
| `favicons/` | `favicon.svg` (dark-tab aware), `favicon.ico` (16+32), `apple-touch-icon.png` (180), `icon-192/512.png`, `site.webmanifest` |
| `manifest.json` | Version, per-file sha256 and the set checksum (written by `--stamp`) |

Published read-only at `https://dragonhound.dev/brand/v1/` (same files plus `sync-shared.mjs`),
so a target repo's CI can compare against `https://dragonhound.dev/brand/v1/manifest.json`.

## Tokens

All names start with `--dh-`. Use the tokens; don't copy their values.

- **Colour** (light / dark, switched by `prefers-color-scheme` and overridden by `<html data-theme>`):
  `bg`, `surface`, `surface-2`, `text`, `muted`, `border`, `accent`, `on-accent`, `highlight`, `focus`,
  `success|warn|danger` each with `-ink` and `-tint`, and `demo-ink`, `demo-tint`, `demo-border`.
  - **Text on a tint uses the `-ink` token**, never the fill colour (all `-ink`/`-tint` pairs are at least 5.3:1).
  - `--dh-accent` is for links, buttons and icons. A product may override **only** `--dh-accent` and
    `--dh-on-accent` (Studio purple, Lightbox indigo, Realms amber), at `:root`, in both schemes, and must keep 4.5:1 on `--dh-surface`.
  - `--dh-highlight` (#003366 light, #1a4d80 dark) is the card hover border and glow, and the landing logo's outline trace.
    In dark mode it is 2.1:1 on the background, so it is decorative only.
  - `--dh-focus` is the focus-ring colour: the highlight in light mode (12.2:1), a lighter tint #4a86c4 in dark mode (4.8:1 on bg, 4.4:1 on surface).
- **Type:** `--dh-font` (system-first sans, no webfont), `--dh-mono`; sizes `--dh-text-2xs` 12 px,
  `xs` 13, `sm` 14, `md` 15, `base` 16, `lg` 17, `xl` 18, `2xl` 20, `3xl` 24, `display` (clamp 1.6 to 2.4 rem);
  `--dh-leading` 1.6, `--dh-leading-tight` 1.2, `--dh-weight-semibold|bold`.
- **Space:** `--dh-space-1|2|3|4|5|6|8|10|12|16` = 4 to 64 px on a 4 px base.
- **Radius:** `--dh-radius-sm` 6, `md` 8 (buttons), `lg` 10 (cards), `xl` 14, `pill`.
- **Elevation:** `--dh-shadow-1`, `--dh-shadow-hover` (the card hover: drop shadow plus a 1 px highlight ring in light mode, a highlight glow in dark mode), `--dh-shadow-color`, `--dh-glow`.
- **Focus:** `outline: var(--dh-focus-ring); outline-offset: var(--dh-focus-offset);` (2 px, 3 px offset).
- **Motion:** `--dh-dur-fast` .15 s (colour), `--dh-dur` .2 s (border, shadow, lift), `--dh-dur-slow` .35 s (image zoom),
  `--dh-dur-draw` 1.3 s (one-off reveals); `--dh-ease`, `--dh-ease-out` (entering), `--dh-ease-in` (leaving).
- **Layout:** `--dh-max` 1080 px, `--dh-gutter` 16 px, `--dh-strip-h` 30 px.

**Card hover, the house style:**

```css
.card { transition: border-color var(--dh-dur), box-shadow var(--dh-dur), transform var(--dh-dur); }
.card:is(:hover, :focus-within) { border-color: var(--dh-highlight); box-shadow: var(--dh-shadow-hover); transform: translateY(var(--dh-lift)); }
.card :focus-visible { outline: var(--dh-focus-ring); outline-offset: var(--dh-focus-offset); }
```

**Reduced motion:** movement goes through `--dh-lift`, `--dh-zoom` and `--dh-dur-draw`, which the tokens set
to `0px`, `1` and `0s` under `prefers-reduced-motion: reduce`. Colour and opacity fades keep their
durations. So write `transform: translateY(var(--dh-lift))` and never a literal pixel lift, and you don't
need your own reduced-motion block for hover effects.

**Tailwind 4:** map in `@theme inline`, e.g. `--color-bg: var(--dh-bg); --color-accent: var(--dh-accent); --radius-lg: var(--dh-radius-lg); --font-sans: var(--dh-font);`.

## Demo-state vocabulary

Four labels replace the seven found in the audit ("RECORDED", "DEMO", "DEMO SAMPLE", "NOT IN DEMO",
"COMING SOON", "Recorded pipeline run", "demo on recorded data"). Sentence case, one badge component, a
`title` that says what it means.

| Label | Class | Use when | Example `title` |
|---|---|---|---|
| **Recorded** | `.dh-badge` | Real output from a real run, replayed. The default for every demo page. | "Recorded output from a real run; no model runs while you browse" |
| **Sample data** | `.dh-badge dh-badge--sample` | Illustrative or synthetic input or output, not from a real run. | "Synthetic sample to show the layout; not real output" |
| **In-browser** | `.dh-badge dh-badge--browser` | Computed live on the client, from your input, right now. | "Runs in your browser; nothing is sent anywhere" |
| **Not in this demo** | `.dh-badge dh-badge--off` | The feature needs the real backend (GPU, model, writes). Show the control disabled with this badge. | "Needs the self-hosted backend; see the README" |

```html
<span class="dh-badge" title="Recorded output from a real run; no model runs while you browse">Recorded</span>
```

Retired: "Demo", "Demo sample", "Coming soon" (inside a demo), "Recorded pipeline run", "demo on recorded data".
The strip's own label is fixed: "Live demo · recorded output" ("Live demo" on phones).

## Demo strip

Paste `dh-strip.html` as the first element in `<body>` after the skip link, include `dh-strip.css`
after the tokens, and put `aria-current="true"` on the current site's link. It is a `<nav aria-label="Dragonhound Labs demos">`
landmark, 30 px tall, no JS. Links are same-tab (all `*.dragonhound.dev` hosts are internal: make sure your
external-link rewriter treats them that way). Below 560 px the "Dragonhound Labs" text and "· recorded output" are
visually hidden (still read out) and, as a last resort, the bar scrolls sideways instead of wrapping.
If your header is sticky, offset it by `var(--dh-strip-h)` or put the strip inside it.

## Theme

```html
<meta name="color-scheme" content="light dark">
<script src="/dh-theme.js"></script>            <!-- blocking, in <head>: sets data-theme before first paint -->
...
<button type="button" data-dh-theme-toggle aria-label="Dark theme" aria-pressed="false">…</button>
```

- External file, no inline code: covered by `script-src 'self'` under a hash or nonce CSP, and it creates no HTML (Trusted Types safe).
  With a nonce policy that has `'strict-dynamic'`, give the tag your nonce.
- Two states, system default: toggling stores an override in a `dh-theme` cookie (`Domain=.dragonhound.dev; Path=/; SameSite=Lax; Secure`, one year); toggling back to the system scheme deletes it. On other hosts (localhost, `*.pages.dev`) the cookie is host-only.
- It re-reads the cookie when a tab becomes visible again, so a change on another subdomain carries over.
- The landing page's old `localStorage.theme` is migrated once. A site with its own 3-state toggle should drop it for this one.
- Dark-only site (Lightbox): `<html data-theme="dark" data-dh-theme-lock>`, no toggle; the script does nothing.
- Next.js: put the tag in the root layout's `<head>` as a plain `<script src>` (not `next/script` with `afterInteractive`), and add `suppressHydrationWarning` to `<html>`.
- `window.dhTheme.get()` / `.set("light" | "dark" | null)` for anything else.
- The cookie must be mentioned anywhere a site says "no cookies".

## Favicons

Copy `favicons/*` to the site root and add:

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
```

`favicon.svg` is the mark in ink #1c1f22 with a `prefers-color-scheme: dark` rule inside (light ink #e6e8ea).
The PNG and ICO sizes sit on the brand tile #1d5f74 so they read on any tab bar. Regenerate with
`npm i --no-save playwright && node scripts/build-favicons.mjs` (writes `shared/favicons/` and the landing's `public/`).

## Versioning, checksum and sync

- `manifest.json` holds the version (semver: patch = fix, minor = new token or class, major = rename or removal; a major bump also moves the published path to `/brand/v2/`), each file's sha256 (text hashed with LF line endings) and `checksum`, the sha256 of the sorted `"<sha>  <path>"` lines. `dh-tokens.css` also carries its own body checksum in its header.
- After any change here: `npm run shared:stamp` (add `-- --version 1.1.0` to bump). `npm run build` runs `shared:check` first and fails if the manifest, the header checksum or the landing's copies in `public/` are stale.
- Vendor into another repo (from this repo): `node scripts/sync-shared.mjs ../argus-studio --dest frontend/vendor/dh` (default dest `vendor/dh`). It copies the files plus `manifest.json` and `sync-shared.mjs`, and writes `.dh-shared.json` (version, checksum, dest, file hashes) at the repo root.
- Check in the target repo: `node vendor/dh/sync-shared.mjs --check .` fails if a vendored file was edited; add `--against https://dragonhound.dev/brand/v1/manifest.json` to also fail when it no longer matches the published source (`--allow-outdated` turns a newer upstream version into a warning).

CI snippet for a target repo (GitHub Actions):

```yaml
  dh-shared:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: node vendor/dh/sync-shared.mjs --check . --against https://dragonhound.dev/brand/v1/manifest.json --allow-outdated
```

## Adoption checklist (WP6 Studio, WP7 Lightbox and Realms)

1. Vendor: `node scripts/sync-shared.mjs <repo> [--dest …]`, commit `vendor/dh/` and `.dh-shared.json`, add the CI job above.
2. Tokens: load `dh-tokens.css` before the site's CSS (Tailwind: `@import` it, then map `@theme inline` to `--dh-*`). Replace local neutrals, radius, focus and status colours with tokens; keep only the product `--dh-accent`/`--dh-on-accent` override. Text on tints uses `-ink`.
3. Type: drop webfonts for `--dh-font` (Studio may keep Geist Mono for code via `--dh-mono` override, documented).
4. Theme: `dh-theme.js` in `<head>`, `data-dh-theme-toggle` on the toggle; remove the old theme code and any inline theme bootstrap (and its CSP hash). Lightbox: `data-theme="dark" data-dh-theme-lock`.
5. Strip: replace DemoBanner / the demo pill with `dh-strip.html` + `dh-strip.css`, `aria-current="true"` on your link, after the skip link, same-tab links.
6. Badges: `dh-badge.css` and the four labels above; remove the retired ones.
7. Favicons: copy `favicons/*` to the public root, add the four `<link>`s, delete the old icons (Studio: the Next.js default).
8. Cards (where a site has them): the card-hover snippet above.
9. Verify: 390 px and 1440 px in both themes, toggle on one subdomain and reload another (cookie `Domain=.dragonhound.dev`), zero CSP errors, Lighthouse unchanged or better.
