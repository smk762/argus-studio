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

## Layout

Everything is under `frontend/` (Next.js 16 App Router, React 19, Tailwind v4, light and dark themes). Repo root holds only compose + env.

- `frontend/src/app/` — routes: `page.tsx` (caption), `curate/`, `forge/`, `gallery/`, `proof/`, `atlas/`, `darkroom/`, and `docs/` (MDX; `page.mdx` + per-parameter concept pages). `layout.tsx` injects the runtime-config `<script>` before hydration.
- `frontend/src/lib/` — thin fetch clients, one per backend: `lensApi.ts`, `curatorApi.ts`, `forgeApi.ts`, `galleryApi.ts`, `proofApi.ts`, `atlasApi.ts`, `darkroomApi.ts`. Plus `runtimeConfig.ts` (the env-resolution core) and `curatorEnv.ts` (named accessors).
- `frontend/src/components/` — shared UI plus `gallery/` (`ArchiveBrowser.tsx`), `curator/` (e.g. `ExportPanel.tsx`, `SelectionInsights.tsx`, `FolderPicker.tsx`, `forgeDemo.ts`), `proof/` (`ProofBoard.tsx`, `NewEvaluation.tsx`), `atlas/` (`NewCanvas.tsx`, `JobView.tsx`, `BakePanel.tsx`), `darkroom/` (ported from argus-safelight), and `docs/`.
- `compose.yaml` — the whole stack, gated by **profiles**. `compose.gpu.yaml` is an NVIDIA override layered on top.
- `.env.example` — every wiring var; copy to `.env`. `.github/workflows/release.yml` — GHCR image publish.

There is **no Next API-proxy layer**: the browser calls each backend directly (cross-origin), so the backends must send CORS headers.

## Commands

```bash
# Frontend dev (host), from frontend/:
npm install
npm run dev            # next dev on :3000
npm run build          # next build (output: "standalone")
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm test               # vitest run (unit tests: src/**/*.test.ts)
npm run wire:check     # fail if src/lib/generated drifts from schema/pins.json
npm run wire:pull      # fetch each pin's tag, update its sha256, regenerate the types

# Whole stack via Docker, from repo root — backends run from published GHCR
# images by default; pick which with profiles:
docker compose up                       # frontend only (demo mode, no backend)
docker compose --profile curator up     # + argus-curator
docker compose --profile lens    up     # + argus-lens
docker compose --profile gallery up     # argus-quarry acquisition job -> DATASET_DIR
ARGUS_CURATOR_UI_MODE=live \
  docker compose --profile forge up      # + curator + forge
docker compose --profile proof   up     # + argus-proof
docker compose --profile atlas   up     # + argus-atlas (bake off unless ATLAS_ALLOW_BAKE=1)
docker compose --profile darkroom up    # + argus-darkroom (needs DARKROOM_SINGGUARD_URL; not in full)
docker compose --profile full    up     # everything but darkroom (pulls any MISSING images, then runs)
docker compose --profile full    pull   # refresh images to the current *_TAG
docker compose -f compose.yaml -f compose.gpu.yaml --profile full up            # + GPUs

# Build the backends from local source instead (opt-in): clone the sibling
# repos next to this one, then layer the build override.
docker compose -f compose.yaml -f compose.build.yaml --profile full up --build  # from source
```

`node`/`npm` may not be on the dev host's PATH; the same commands run in the Dockerfile's base image, e.g. `docker run --rm -v "$PWD":/app -v studio-nm:/app/node_modules -w /app node:22.23.4-alpine sh -c "npm ci && npm test"` from `frontend/` (the named volume keeps the container's `node_modules` off the host's).

Backends default to **published GHCR images** — no sibling checkouts needed. To build from source instead, clone the siblings (`../argus-lens`, etc.) next to this repo and add `-f compose.build.yaml … up --build`. `frontend` is the exception: it has no published image, so it always builds from `./frontend` — re-run with `--build` after changing frontend source (a plain `up` reuses the existing image). `up` also does **not** re-pull an image already cached under a mutable tag like `latest`; use `docker compose … pull` to refresh.

## Conventions & gotchas

- **Config is resolved per request, never baked into the client bundle** (argus-studio#56). `runtimeConfig.ts` reads `process.env` through a *computed* key and the layout serializes the result into `window.__ARGUS_ENV__`. Do **not** "simplify" the lookups in `firstDefined`/`resolveBase` to literal `process.env.FOO` — Next's inliner would bake the value in and one published image could no longer deploy to a second origin. The `release.yml` image takes **no build-args**.
- **Reach backends only through the accessors in `curatorEnv.ts`** (`lensUrl()`, `forgeUrl()`, …) — they are functions, not consts, because the config isn't known at module-eval time on the client. A module-scope const captures stale/empty values.
- **Cross-origin means CORS.** The browser hits `:8100–:8106` directly, so a standalone backend must be started with `--cors` (e.g. `argus-forge serve --cors`, `argus-curator serve --cors`) or the request fails in the browser. In compose the images set a sane default `--cors` (localhost:3000); widen via each service's `*_CORS_ORIGINS` for a LAN/public origin.
- **Empty URL = same origin; unset = localhost dev default.** An explicitly empty `ARGUS_*_URL` makes clients build relative paths (for a reverse proxy). A path prefix (`/api/curator`) is how you put more than one backend behind one origin — the six services share `/health`, `/folders`, `/thumb`, so at most one can live at the root.
- **`demo` vs `live`.** `ARGUS_CURATOR_UI_MODE=demo` (default) serves a bundled read-only sample with no backend; `live` talks to the real curator. The `/forge` export handoff needs `live`. `local` is a legacy alias for `live`.
- **The repo-root `.env` is read by `docker compose` only.** A host `npm run dev` does not see it — put local overrides in `frontend/.env.local`. Legacy `NEXT_PUBLIC_*` names are still honoured as fallbacks; `NEXT_PUBLIC_API_URL` is now `ARGUS_LENS_URL`.
- **Every page of the server build is served with a nonce CSP** (`src/proxy.ts`, `lib/csp.ts`; `ARGUS_CSP=enforce|report-only|off`). An inline `<script>` needs `nonce={(await headers()).get("x-nonce")}` (skipped when `STATIC_DEMO`, which has no request) or it is blocked, and a script it injects must be created from script ('strict-dynamic'), not parsed from HTML. The policy is scripts-only on purpose: no `default-src`/`connect-src`, because backend URLs are runtime config. Don't pin it in `next.config.ts` `headers()`: a static header cannot carry a per-request nonce.
- **Every backend write is gated in its client, not its component** (argus-studio#75). Each `lib/*Api.ts` keeps a `healthMemo` of its service's last `/health` (refreshed by its `get*Health`, fetched on demand otherwise) and runs `requireCapability(...)` before the request, throwing `CapabilityRefused` (an `Error`, so existing error spans render it). Add the same guard to any new write fetcher; components still read the `allows*` helpers to disable controls up front, but the client is what guarantees a refused write never reaches the wire.
- **Curator's `adult-*` SingGuard policies stay out of normal UI** until its evaluation picks one, though `/detectors` lists them: offer policies through `offeredPolicies()`, on `/curate` and `/darkroom`. `DEVMODE=1` (`devMode()`) shows them all, and compose also passes it to `CURATOR_DEVMODE` and `ARGUS_DARKROOM_DEVMODE`, so nothing restricts deleting. That is its whole reach: it never loosens viewing, move, bakes, fetches or NSFW, and a delete always takes a user's confirm.
- **Darkroom's browser decides nothing** (`lib/darkroom/`, `components/darkroom/`). Outcome, cell states, blur and the fired rule all come from the record. Never render an image for a deleted, omitted, refused or failed record: `hasImage()` is the gate. Rule names come from the data, because `adult-cinematic`'s letters differ from the other adult policies. `POST /preflight` counts as a write, so `read_only` disables Check as well as Generate.
- **Wire types are generated.** `src/lib/generated/` comes from the curator, forge and proof schemas pinned in `frontend/schema/pins.json`: never hand-edit it. `lib/wire.ts` holds `Filled<T, K>` and the compile-time checks. Types that tolerate older servers or decide blurring, such as `ImageResult` and `NsfwResult`, stay hand-written on purpose.
- **Colours come from tokens, for both themes.** `data-theme` is set by the boot script first in `<head>`. Use `text-on-accent` on an accent background, not `text-black`. Darkroom's and curator's shield marks stay separate: curator verdicts are only safe or unsafe.
- **The React Compiler lint rules are on.** A `set-state-in-effect` suppression is fine for an effect that only fetches, with the reason beside it. Declare a memoized value before any closure that uses it, or the compiler gives up on the component.
- **Tests cover `src/lib`'s pure logic, not components** (vitest, node environment, `@/` aliased in `vitest.config.ts`). Put a `*.test.ts` next to the module; the wire seams (`normalizeExportResult`, `manifestMajor`), capability readers and `resolveRuntimeConfig` are the contracts worth pinning. There is no DOM test setup.
- **Container vs host paths:** forge/curator configs reference container paths (`/data/out`, `/data/images`); when running a forged `train.sh` on the host, substitute your `OUTPUT_DIR`/`DATASET_DIR`. Shared volumes are the only cross-service coupling — don't assume `localhost` inside compose (services use DNS names like `http://argus-lens:8100`).
- **Static demo build (`NEXT_PUBLIC_DEMO_STATIC=1`, `npm run build:static`).** A separate *build* (Next `output: "export"` → `frontend/out/`), not a runtime mode: `lib/staticDemo.ts` exports the inlined `STATIC_DEMO` constant, `runtimeConfig()` returns a fixed demo config, and each page swaps its API calls for bundled recordings under `public/demo/` (plus `lib/lensSample.ts`). This is the one sanctioned literal `process.env.NEXT_PUBLIC_*` read. The root layout opts into per-request rendering with `await connection()` unless `STATIC_DEMO` — segment config (`export const dynamic`) must be a literal, so it cannot branch. New pages must render without a backend when `STATIC_DEMO` is set (recorded data + `<RecordedDemoNote>`, never a spinner or "unreachable").
- **The static demo's CSP is generated at build time** by `frontend/scripts/csp.mjs` (run by `build:static` only): a `<meta>` CSP per exported page with the sha256 of each inline script and `<style>`, plus `out/_headers` (frame-ancestors, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP, HSTS) for Cloudflare Pages. Don't add inline scripts or third-party origins without updating the policy, and check a built page in a browser for `securitypolicyviolation` events. No Trusted Types: Next's runtime writes plain strings to `script.src`/`innerHTML`. The normal server build instead gets a per-request nonce CSP from `src/proxy.ts` (`lib/csp.ts`, `ARGUS_CSP`); a static export runs no proxy, so the layout reads `x-nonce` only when `STATIC_DEMO` is unset.
- **Modern Web Guidance.** Use Chrome's [modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) skill (enabled in `.claude/settings.json`; a local copy installed with `npx -y modern-web-guidance@latest install --agent claude-code` in `frontend/` is gitignored): search it before writing UI, CSS animation or browser-API code in `frontend/`, and re-run `npx -y modern-web-guidance@latest legacy-scan frontend/src` after big changes.

## Branches

`dev` is the default branch and the base for every PR. The one exception is a PR stacked on another open PR into `dev`: it targets that PR's branch, then is retargeted to `dev` once its parent merges. Never open a PR against `main` or push to it directly. `main` only moves by fast-forwarding to `dev` (`git push origin origin/dev:main`), so it stays an ancestor of `dev`. If `main` is ever protected so that a release needs a PR from `dev`, the merge commit it leaves on `main` (one commit ahead of `dev`, identical tree) is allowed too: leave it and don't merge `main` back into `dev`. Anything else on `main` that `dev` lacks is a mistake. A branch cut from `main` must be rebased or merged onto `origin/dev`, never the other way round.

## CI / release

`ci.yml` gates every PR and every push to `dev` and `main`: `npm ci`, `wire:check`, lint, typecheck, `npm test` in `frontend/`. `suite.yml` (argus-ci's `suite-check`) fails if the argus-suite block above or this repo's SUITE.md row goes missing. `release.yml` builds `frontend/` and pushes `ghcr.io/smk762/argus-studio` (linux/amd64+arm64) on `v[0-9]*` tags — no build-time config. Before tagging, move the release's entries into a dated section of `CHANGELOG.md` and bump `frontend/package.json` (+ the two root `version` fields in `package-lock.json`) to match the tag, and update this repo's row in argus-cortex's SUITE.md if the release changed a capability, port or UI pairing. See README.md and `compose.yaml` (heavily commented) for the source of truth on wiring and volumes.
