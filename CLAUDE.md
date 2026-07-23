# CLAUDE.md — argus-studio

Guidance for AI agents working in this repo. Human-facing usage lives in [README.md](README.md); this file is the orientation an agent needs to change code safely.

## What this is

The Argus suite's **web UI + compose orchestration hub**. A Next.js frontend on **:3000** that ties the backend services together and a root `compose.yaml` that runs them from published GHCR images by default (with an opt-in `compose.build.yaml` to build from sibling repos). This is **not** a pip package like the rest of the suite — there is no backend code here. The frontend renders JSON it fetches from five HTTP services (each in its own repo):

| Service | Port | UI surface | Repo |
|---|---|---|---|
| argus-lens | :8100 | `/` caption page | ../argus-lens |
| argus-curator | :8101 | `/curate` | ../argus-curator |
| argus-quarry | :8102 | `/gallery` (read-only provenance) | ../argus-quarry |
| argus-forge | :8103 | `/forge` (LoRA training configs) | ../argus-forge |
| argus-proof | :8104 | `/proof` (post-training eval + HITL) | ../argus-proof |

Formerly `argus-vision-demo`; the old GitHub URL redirects to `smk762/argus-studio`. Keep new references pointing at the current name.

## Layout

Everything is under `frontend/` (Next.js 16 App Router, React 19, Tailwind v4, dark theme). Repo root holds only compose + env.

- `frontend/src/app/` — routes: `page.tsx` (caption), `curate/`, `forge/`, `gallery/`, `proof/`, and `docs/` (MDX; `page.mdx` + per-parameter concept pages). `layout.tsx` injects the runtime-config `<script>` before hydration.
- `frontend/src/lib/` — thin fetch clients, one per backend: `lensApi.ts`, `curatorApi.ts`, `forgeApi.ts`, `galleryApi.ts`, `proofApi.ts`. Plus `runtimeConfig.ts` (the env-resolution core) and `curatorEnv.ts` (named accessors).
- `frontend/src/components/` — shared UI plus `curator/` (e.g. `ExportPanel.tsx`, `SelectionInsights.tsx`, `FolderPicker.tsx`, `forgeDemo.ts`), `proof/` (`ProofBoard.tsx`, `NewEvaluation.tsx`), and `docs/`.
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

# Whole stack via Docker, from repo root — backends run from published GHCR
# images by default; pick which with profiles:
docker compose up                       # frontend only (demo mode, no backend)
docker compose --profile curator up     # + argus-curator
docker compose --profile lens    up     # + argus-lens
docker compose --profile gallery up     # argus-quarry acquisition job -> DATASET_DIR
ARGUS_CURATOR_UI_MODE=live \
  docker compose --profile forge up      # + curator + forge
docker compose --profile proof   up     # + argus-proof
docker compose --profile full    up     # everything (pulls any MISSING images, then runs)
docker compose --profile full    pull   # refresh images to the current *_TAG
docker compose -f compose.yaml -f compose.gpu.yaml --profile full up            # + GPUs

# Build the backends from local source instead (opt-in): clone the sibling
# repos next to this one, then layer the build override.
docker compose -f compose.yaml -f compose.build.yaml --profile full up --build  # from source
```

Backends default to **published GHCR images** — no sibling checkouts needed. To build from source instead, clone the siblings (`../argus-lens`, etc.) next to this repo and add `-f compose.build.yaml … up --build`. `frontend` is the exception: it has no published image, so it always builds from `./frontend` — re-run with `--build` after changing frontend source (a plain `up` reuses the existing image). `up` also does **not** re-pull an image already cached under a mutable tag like `latest`; use `docker compose … pull` to refresh.

## Conventions & gotchas

- **Config is resolved per request, never baked into the client bundle** (argus-studio#56). `runtimeConfig.ts` reads `process.env` through a *computed* key and the layout serializes the result into `window.__ARGUS_ENV__`. Do **not** "simplify" the lookups in `firstDefined`/`resolveBase` to literal `process.env.FOO` — Next's inliner would bake the value in and one published image could no longer deploy to a second origin. The `release.yml` image takes **no build-args**.
- **Reach backends only through the accessors in `curatorEnv.ts`** (`lensUrl()`, `forgeUrl()`, …) — they are functions, not consts, because the config isn't known at module-eval time on the client. A module-scope const captures stale/empty values.
- **Cross-origin means CORS.** The browser hits `:8100–:8104` directly, so a standalone backend must be started with `--cors` (e.g. `argus-forge serve --cors`, `argus-curator serve --cors`) or the request fails in the browser. In compose the images set a sane default `--cors` (localhost:3000); widen via each service's `*_CORS_ORIGINS` for a LAN/public origin.
- **Empty URL = same origin; unset = localhost dev default.** An explicitly empty `ARGUS_*_URL` makes clients build relative paths (for a reverse proxy). A path prefix (`/api/curator`) is how you put more than one backend behind one origin — the five services share `/health`, `/folders`, `/thumb`, so at most one can live at the root.
- **`demo` vs `live`.** `ARGUS_CURATOR_UI_MODE=demo` (default) serves a bundled read-only sample with no backend; `live` talks to the real curator. The `/forge` export handoff needs `live`. `local` is a legacy alias for `live`.
- **The repo-root `.env` is read by `docker compose` only.** A host `npm run dev` does not see it — put local overrides in `frontend/.env.local`. Legacy `NEXT_PUBLIC_*` names are still honoured as fallbacks; `NEXT_PUBLIC_API_URL` is now `ARGUS_LENS_URL`.
- **Container vs host paths:** forge/curator configs reference container paths (`/data/out`, `/data/images`); when running a forged `train.sh` on the host, substitute your `OUTPUT_DIR`/`DATASET_DIR`. Shared volumes are the only cross-service coupling — don't assume `localhost` inside compose (services use DNS names like `http://argus-lens:8100`).

## CI / release

`release.yml` builds `frontend/` and pushes `ghcr.io/smk762/argus-studio` (linux/amd64+arm64) on `v[0-9]*` tags — no build-time config. See README.md and `compose.yaml` (heavily commented) for the source of truth on wiring and volumes.
