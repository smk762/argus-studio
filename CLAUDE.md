# CLAUDE.md — argus-studio

Guidance for AI agents working in this repo. Human-facing usage lives in [README.md](README.md); this file is the orientation an agent needs to change code safely.

## What this is

The Argus suite's **web UI + compose orchestration hub**. A Next.js frontend on **:3000** that ties the backend services together and a root `compose.yaml` that runs them from published GHCR images by default (with an opt-in `compose.build.yaml` to build from sibling repos). This is **not** a pip package like the rest of the suite — there is no backend code here. The frontend renders JSON it fetches from seven HTTP services (each in its own repo):

| Service | Port | UI surface | Repo |
|---|---|---|---|
| argus-lens | :8100 | `/` caption page | ../argus-lens |
| argus-curator | :8101 | `/curate` | ../argus-curator |
| argus-quarry | :8102 | `/gallery` (pool provenance + PD12M/Megalith Sources) | ../argus-quarry |
| argus-forge | :8103 | `/forge` (LoRA training configs) | ../argus-forge |
| argus-proof | :8104 | `/proof` (post-training eval + HITL) | ../argus-proof |
| argus-atlas | :8105 | `/atlas` (DEM → georeferenced fantasy-map PMTiles) | ../argus-atlas |
| argus-darkroom | :8106 | `/darkroom` (guarded generation) | ../argus-darkroom |
| argus-survey | :8107 | none here: footer link to **argus-sightline** (:3107, `ARGUS_SIGHTLINE_URL`); both run under the `survey` profile (not in `full`) | ../argus-survey, ../argus-sightline |
| argus-mask | :8109 | none here: footer link to its own viewer (`ARGUS_MASK_URL`); runs under the `mask` profile (not in `full`) | ../argus-mask |

Formerly `argus-vision-demo`; the old GitHub URL redirects to `smk762/argus-studio`. Keep new references pointing at the current name.

## Argus suite
<!-- argus-suite: keep this block; argus-ci checks for it -->
This repo is part of the Argus suite. The suite map below lists every sibling and what it owns; check it before
building something a sibling may already do. **On every release, update this repo's row and capabilities in
argus-cortex's SUITE.md** (a PR to argus-cortex in the same release).

@../argus-core/SUITE.md

Not checked out? Read https://github.com/smk762/argus-cortex/blob/dev/SUITE.md

## Must never happen

Each rule names what fails when it is broken. **UNENFORCED** means only this file says so: add a check rather than more prose, and link the issue from the row. A rule about code shape (a banned import or API) can go in argus-ci's suite-rules catalogue instead of a test here. The reasons are in Conventions below.

| Never | Enforced by |
|---|---|
| Layer `compose.train.yaml` on a public demo. It arms live forge training: the `-train` image, the GPU and `ARGUS_FORGE_READONLY=0` | Partial: `repoRules.test.ts` (only that file arms training, and no workflow layers it). The deployed stack is **UNENFORCED**: smk762/argus-halo#33 |
| Arm training from `compose.gpu.yaml`, `compose.yaml` or `.env.example` | `repoRules.test.ts` |
| Read a literal `process.env.NAME` in `src/` (only `NODE_ENV`, and `staticDemo.ts`'s one flag) | ESLint `no-restricted-syntax` (`eslint.config.mjs`) |
| Give the release image a build-arg or the Dockerfile an `ARG` | `repoRules.test.ts` |
| Call a `curatorEnv.ts` accessor or `runtimeConfig()` at module scope | ESLint `no-restricted-syntax` |
| Send a backend write that its client did not gate | `writeGateCoverage.test.ts` finds every non-GET fetcher in `lib/*Api.ts`; `writeGates.test.ts` proves the known ones refuse |
| Offer curator's `adult-*` SingGuard policies outside dev mode | `curatorGuard.test.ts` |
| Let dev mode loosen viewing, move, bakes, fetches or NSFW | `repoRules.test.ts` (`devMode()` reaches only `offeredPolicies`) |
| Delete without the user's confirm | Typecheck: every fetcher that deletes takes a `Confirmed` (`lib/confirmed.ts`), minted only by `askConfirm` or the user's own click. `writeGateCoverage.test.ts` finds the deleting fetchers; `writeGates.test.ts` proves a forged or spent one sends nothing |
| Render a darkroom image for a deleted, omitted, refused or failed record, or a removed one | `components/darkroom/recordImages.test.ts` renders every view for every fixture record and reads the markup; `lib/darkroom/outcome.test.ts` pins `hasImage()`; Bombadil `darkroomWithholdsImages` checks the pages it reaches |
| Hand-edit `src/lib/generated/` | CI `npm run wire:check` |
| Hand-edit `frontend/vendor/dh/` | CI `dh-shared` job, `dhShared.test.ts` |
| Hand-edit recorded demo output, or move curator's wire pin without its recording | `demoRecordings.test.ts` |
| Copy the opsec rules out of `scripts/opsec.mjs` | `docsOpsec.test.ts` |
| Ship an inline script without the nonce, or loosen the policy | `csp.test.ts`, `trustedTypes.test.ts`, CI `static-overflow` (CSP violations on the export) |
| Write an HTML string to the DOM (`innerHTML` and the like) | ESLint `no-restricted-syntax` |
| Pin the CSP in `next.config.ts` `headers()` | `repoRules.test.ts` |
| Add a setup or package page under `src/app/docs/` | `handbook.test.ts` (the moved prefixes redirect), `docsNav.test.ts` |
| Point Bombadil at a live backend | Structural: CI serves the static export |
| Drop the Argus suite block above, or this repo's SUITE.md row | CI `suite.yml` |

## Layout

Everything is under `frontend/` (Next.js 16 App Router, React 19, Tailwind v4, light and dark themes). The repo root holds only compose and env: `compose.yaml` is the whole stack, gated by profiles, with `compose.gpu.yaml` (NVIDIA), `compose.train.yaml` (live forge training) and `compose.build.yaml` (build the backends from sibling checkouts) as overrides. `src/lib/` has one thin fetch client per backend (`*Api.ts`), plus `runtimeConfig.ts` (the env-resolution core) and `curatorEnv.ts` (named accessors).

There is **no Next API-proxy layer**: the browser calls each backend directly (cross-origin), so the backends must send CORS headers.

## Commands

```bash
# From frontend/:
npm run dev            # next dev on :3000
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm test               # vitest run (unit tests: src/**/*.test.ts)
npm run wire:check     # fail if src/lib/generated drifts from schema/pins.json
npm run wire:pull      # fetch each pin at its dev HEAD (`-- curator` for one), record commit/version/sha256, regenerate

# From the repo root: the stack, by profile (README.md and compose.yaml list them all).
docker compose up                       # frontend only (demo mode, no backend)
docker compose --profile full up        # everything but darkroom, survey and mask
```

`node`/`npm` may not be on the dev host's PATH; the same commands run in the Dockerfile's base image, e.g. `docker run --rm -v "$PWD":/app -v studio-nm:/app/node_modules -w /app node:22.23.4-alpine sh -c "npm ci && npm test"` from `frontend/` (the named volume keeps the container's `node_modules` off the host's; the repo-root rules in `repoRules.test.ts` skip there, and run in CI).

Backends default to **published GHCR images**. `frontend` has no published image, so it always builds from `./frontend`: re-run with `--build` after changing frontend source. `up` does **not** re-pull an image already cached under a mutable tag; use `docker compose … pull`.

## Conventions & gotchas

- **Config is resolved per request, never baked into the client bundle** (argus-studio#56). `runtimeConfig.ts` reads `process.env` through a *computed* key and the layout serializes the result into `window.__ARGUS_ENV__`. Do **not** "simplify" the lookups in `firstDefined`/`resolveBase` to literal `process.env.FOO` — Next's inliner would bake the value in and one published image could no longer deploy to a second origin. The `release.yml` image takes **no build-args**.
- **Reach backends only through the accessors in `curatorEnv.ts`** (`lensUrl()`, `forgeUrl()`, …) — they are functions, not consts, because the config isn't known at module-eval time on the client. A module-scope const captures stale/empty values.
- **Cross-origin means CORS.** The browser hits `:8100–:8106` directly, so a standalone backend must be started with `--cors` (e.g. `argus-forge serve --cors`, `argus-curator serve --cors`) or the request fails in the browser. In compose the images set a sane default `--cors` (localhost:3000); widen via each service's `*_CORS_ORIGINS` for a LAN/public origin.
- **Empty URL = same origin; unset = localhost dev default.** An explicitly empty `ARGUS_*_URL` makes clients build relative paths (for a reverse proxy). A path prefix (`/api/curator`) is how you put more than one backend behind one origin — the six services share `/health`, `/folders`, `/thumb`, so at most one can live at the root.
- **`demo` vs `live`.** `ARGUS_CURATOR_UI_MODE=demo` (default) serves a bundled read-only sample with no backend; `live` talks to the real curator. The `/forge` export handoff needs `live`. `local` is a legacy alias for `live`. `/forge` and `/proof` follow it unless `ARGUS_FORGE_UI_MODE` / `ARGUS_PROOF_UI_MODE` is set (`forgeLive()`, `proofLive()`), so a public demo can keep curator on its sample while those pages call read-only servers (#59). Gate a page on its own stage's mode, never on `isLive()` for another service.
- **The repo-root `.env` is read by `docker compose` only.** A host `npm run dev` does not see it — put local overrides in `frontend/.env.local`. Legacy `NEXT_PUBLIC_*` names are still honoured as fallbacks; `NEXT_PUBLIC_API_URL` is now `ARGUS_LENS_URL`.
- **Every page of the server build is served with a nonce CSP** (`src/proxy.ts`, `lib/csp.ts`; `ARGUS_CSP=enforce|report-only|off`). An inline `<script>` needs `nonce={(await headers()).get("x-nonce")}` (skipped when `STATIC_DEMO`, which has no request) or it is blocked, and a script it injects must be created from script ('strict-dynamic'), not parsed from HTML. The policy is scripts-only on purpose: no `default-src`/`connect-src`, because backend URLs are runtime config. Don't pin it in `next.config.ts` `headers()`: a static header cannot carry a per-request nonce. Trusted Types is a dry run (#198): `ARGUS_CSP=report-only` adds `require-trusted-types-for 'script'` and the layout's first head script registers a `default` policy (`lib/trustedTypes.ts`) that admits only this origin's `/_next/static/chunks/*.js` script URLs and returns null for anything else; it has no `createHTML`, so never write strings to `innerHTML` and the like. Enforce mode carries neither until the dry run is clean on real traffic.
- **Every backend write is gated in its client, not its component** (argus-studio#75). Each `lib/*Api.ts` keeps a `healthMemo` of its service's last `/health` (refreshed by its `get*Health`, fetched on demand otherwise) and runs `requireCapability(...)` before the request, throwing `CapabilityRefused` (an `Error`, so existing error spans render it). Add the same guard to any new write fetcher (`writeGateCoverage.test.ts` fails until it has one, or an entry in its `UNGATED` list with the reason); components still read the `allows*` helpers to disable controls up front, but the client is what guarantees a refused write never reaches the wire.
- **A delete carries the user's yes to the client** (argus-studio#262). A fetcher that deletes or purges takes a `Confirmed` and calls `spendConfirmation` before its request. Get one from `askConfirm(message)` (the browser's dialog) or `confirmedBy(event)` in a confirm button's `onClick`; it is good for one call, so ask again for the next delete. Never mint one any other way, dev mode included.
- **Curator's `adult-*` SingGuard policies stay out of normal UI** until its evaluation picks one, though `/detectors` lists them: offer policies through `offeredPolicies()`, on `/curate` and `/darkroom`. `DEVMODE=1` (`devMode()`) shows them all, and compose also passes it to `CURATOR_DEVMODE` and `ARGUS_DARKROOM_DEVMODE`, so nothing restricts deleting. That is its whole reach: it never loosens viewing, move, bakes, fetches or NSFW, and a delete always takes a user's confirm.
- **Darkroom's browser decides nothing** (`lib/darkroom/`, `components/darkroom/`). Outcome, cell states, blur and the fired rule all come from the record. Never render an image for a deleted, omitted, refused or failed record: `hasImage()` is the gate. A view that shows one record spreads `recordMarks(record)` (`data-outcome`, `data-removed`) onto its element, and a new view joins `recordImages.test.ts`. Rule names come from the data, because `adult-cinematic`'s letters differ from the other adult policies. `POST /preflight` counts as a write, so `read_only` disables Check as well as Generate.
- **Wire types are generated.** `src/lib/generated/` comes from the cortex, curator, forge and proof schemas pinned in `frontend/schema/pins.json`: never hand-edit it. A pin is the package's `dev` commit and its version there, not a release (#170); the daily `wire-drift` workflow opens a `chore/wire-sync` PR when a `dev` moves on, or an issue when Studio's code must follow a schema change. `lib/wire.ts` holds `Filled<T, K>` and the compile-time checks. Types that tolerate older servers or decide blurring, such as `ImageResult` and `NsfwResult`, stay hand-written on purpose.
- **The forge twins are checked against forge.** `curator/types.ts` (`suggestTrainingParams`, `datasetSizeStatus`, `DATASET_SIZE_GUIDE`) and `curator/forgeDemo.ts` hand-copy argus-forge's heuristics and kohya emitter. `forgeParity.test.ts` checks them against `schema/forge-parity.json`, a `kind: "fixture"` pin that `wire:pull` fetches like a schema. When it fails after a pull, port forge's change into the twins rather than editing the fixture.
- **Suite docs live in argus-handbook, not here.** The setup guides and each package's docs (README + `docs/*.md`) are published by smk762/argus-handbook at `https://docs.dragonhound.dev`; Studio's `/docs` keeps only its captioning concepts. Add a setup or package page there, never under `src/app/docs/`. The old `/docs/setup/…` and `/docs/packages/…` paths 301 to the handbook: `lib/handbook.ts` lists the moved prefixes, `next.config.ts` builds the server build's redirects from it, `public/_redirects` does the same for the static demo, and `lib/handbook.test.ts` holds the two together. Link a handbook page by its absolute URL with the trailing slash (`https://docs.dragonhound.dev/packages/lens/cli/#argus-lens-caption`); it is a family host, so `ExternalLink` opens it in the same tab. The opsec rules live only in `scripts/opsec.mjs`, which `lib/docsOpsec.ts` re-exports for the gate over Studio's own `/docs` sources.
- **Colours, type, radius and focus come from the Dragonhound shared tokens (`--dh-*`), for both themes.** `frontend/vendor/dh/` is vendored from dragonhound-site `shared/` (pinned in `.dh-shared.json`): re-sync with `node scripts/sync-shared.mjs <this repo> --dest frontend/vendor/dh` from a dragonhound-site checkout, then copy `vendor/dh/dh-theme.js` to `frontend/public/`. `globals.css` maps Tailwind's colours onto the tokens and overrides only `--dh-accent` (Studio purple); the other stage accents are Studio-local with an `-ink` twin. **Text on a tint uses the `-ink` colour** (`text-accent-teal-ink` on `bg-accent-teal/10`), never the fill, and an accent background takes `text-on-accent`, not `text-black` or `text-white`. `data-theme` is set by `public/dh-theme.js`, a blocking `<script src>` first in `<head>`; the toggle is any `[data-dh-theme-toggle]` button. Demo-state labels use `<DemoBadge state=…>`, one per page in the header. Favicons are the suite-mark set from argus-cortex `brand/mark/favicon/`, copied unchanged (all rights reserved); the header mark stays the argus-studio mark in `frontend/brand/`. Darkroom's and curator's shield marks stay separate: curator verdicts are only safe or unsafe.
- **The React Compiler lint rules are on.** A `set-state-in-effect` suppression is fine for an effect that only fetches, with the reason beside it. Declare a memoized value before any closure that uses it, or the compiler gives up on the component.
- **Tests cover `src/lib`'s pure logic, not components** (vitest, node environment, `@/` aliased in `vitest.config.ts`). Put a `*.test.ts` next to the module; the wire seams (`normalizeExportResult`, `manifestMajor`), capability readers and `resolveRuntimeConfig` are the contracts worth pinning. There is no DOM test setup.
- **Container vs host paths:** forge/curator configs reference container paths (`/data/out`, `/data/images`); when running a forged `train.sh` on the host, substitute your `OUTPUT_DIR`/`DATASET_DIR`. Shared volumes are the only cross-service coupling — don't assume `localhost` inside compose (services use DNS names like `http://argus-lens:8100`).
- **Static demo build (`NEXT_PUBLIC_DEMO_STATIC=1`, `npm run build:static`).** A separate *build* (Next `output: "export"` → `frontend/out/`), not a runtime mode: `lib/staticDemo.ts` exports the inlined `STATIC_DEMO` constant, `runtimeConfig()` returns a fixed demo config, and each page swaps its API calls for bundled recordings under `public/demo/` (plus `lib/lensSample.ts`). This is the one sanctioned literal `process.env.NEXT_PUBLIC_*` read. The root layout opts into per-request rendering with `await connection()` unless `STATIC_DEMO` — segment config (`export const dynamic`) must be a literal, so it cannot branch. New pages must render without a backend when `STATIC_DEMO` is set (recorded data + `<RecordedDemoNote>`, never a spinner or "unreachable"). Recorded samples follow each package's `dev` HEAD: `frontend/schema/demo.json` names the commit and version behind lens's and curator's, the recording carries that version (`lensSample.ts` metadata, `public/curator-sample/recording.json`), and `demoRecordings.test.ts` holds them (and curator's wire pin) together. Re-record with `scripts/make_curator_sample.py` + `scripts/record_curator_demo.py`, or `argus-lens caption` as `lensSample.ts`'s header says; never hand-edit recorded output.
- **The static demo's CSP is generated at build time** by `frontend/scripts/csp.mjs` (run by `build:static` only): a `<meta>` CSP per exported page with the sha256 of each inline script and `<style>`, plus `out/_headers` (frame-ancestors, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP, HSTS) for Cloudflare Pages. Don't add inline scripts or third-party origins without updating the policy, and check a built page in a browser for `securitypolicyviolation` events. No Trusted Types: Next's runtime writes plain strings to `script.src`/`innerHTML`. The normal server build instead gets a per-request nonce CSP from `src/proxy.ts` (`lib/csp.ts`, `ARGUS_CSP`); a static export runs no proxy, so the layout reads `x-nonce` only when `STATIC_DEMO` is unset.
- **Modern Web Guidance.** Use Chrome's [modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) skill (enabled in `.claude/settings.json`; a local copy installed with `npx -y modern-web-guidance@latest install --agent claude-code` in `frontend/` is gitignored): search it before writing UI, CSS animation or browser-API code in `frontend/`, and re-run `npx -y modern-web-guidance@latest legacy-scan frontend/src` after big changes.

## Branches

`dev` is the default branch and the base for every PR. The one exception is a PR stacked on another open PR into `dev`: it targets that PR's branch, then is retargeted to `dev` once its parent merges. Never open a PR against `main` or push to it directly. `main` only moves by fast-forwarding to `dev` (`git push origin origin/dev:main`), so it stays an ancestor of `dev`. If `main` is ever protected so that a release needs a PR from `dev`, the merge commit it leaves on `main` (one commit ahead of `dev`, identical tree) is allowed too: leave it and don't merge `main` back into `dev`. Anything else on `main` that `dev` lacks is a mistake. A branch cut from `main` must be rebased or merged onto `origin/dev`, never the other way round.

## CI / release

`ci.yml` gates every PR and every push to `dev` and `main`: `npm ci`, `wire:check`, lint, typecheck, `npm test` in `frontend/`. Two of its jobs run against the static demo export:

- `static-overflow` (`scripts/check-overflow.mjs`) loads every route once.
- `bombadil` runs `frontend/bombadil/spec.ts` for 3 minutes of random interaction. Both serve the export with `scripts/static-server.mjs`.

`bombadil` is `continue-on-error` until it proves stable (#241). Properties added to the spec must hold on the static demo. Never point Bombadil at a live backend: random clicks will press delete, purge and move. `bombadil-nightly.yml` runs the same spec for 45 minutes, plus `scripts/check-leaks.mjs`, which reads node and listener counts after a forced GC. Measure leaks there, not with Bombadil's `noResourceLeak`, which counts uncollected garbage (#242). `suite.yml` (argus-ci's `suite-check`) fails if the argus-suite block above or this repo's SUITE.md row goes missing. `release.yml` builds `frontend/` and pushes `ghcr.io/smk762/argus-studio` (linux/amd64+arm64) on `v[0-9]*` tags — no build-time config. Before tagging, move the release's entries into a dated section of `CHANGELOG.md` and bump `frontend/package.json` (+ the two root `version` fields in `package-lock.json`) to match the tag, and update this repo's row in argus-cortex's SUITE.md if the release changed a capability, port or UI pairing. See README.md and `compose.yaml` (heavily commented) for the source of truth on wiring and volumes.
