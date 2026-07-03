# Argus Studio

The Argus suite's web UI and compose orchestration. The main page demonstrates [argus-lens](https://github.com/smk762/argus-lens) structured image captioning — paste a URL, drag in images, pick a server-side folder, or caption straight from an [Immich](https://immich.app) album — and inspects training-optimised caption variants, raw model outputs, and auto-removed tag analysis. A **curator** view at [`/curate`](http://localhost:3000/curate) talks to [argus-curator](https://github.com/smk762/argus-curator) for dataset ingestion, folder scans, and exports. Upstream acquisition ([argus-quarry](https://github.com/smk762/argus-quarry)) runs as a compose profile.

> Formerly `argus-vision-demo` — the old GitHub URL redirects here.

Designed as a living onboarding document -- every parameter includes an inline explanation of what it does and why.

![Input form with pipeline parameters](docs/images/spa-form.png)

![Caption variants output](docs/images/spa-output-variants.png)

![Raw model outputs and auto-removed tags](docs/images/spa-output-raw.png)

## Quick Start

### Whole suite in one stack (recommended)

The suite repos are designed to run together but stay loosely coupled — bring up
only what you need with compose **profiles**. Clone them as siblings first:

```bash
git clone https://github.com/smk762/argus-lens ../argus-lens
git clone https://github.com/smk762/argus-curator ../argus-curator
git clone https://github.com/smk762/argus-quarry ../argus-quarry   # optional: gallery profile
# (this repo is argus-studio)
cp .env.example .env      # set DATASET_DIR / OUTPUT_DIR, choose UI mode, etc.
```

Then, from this repo root:

```bash
docker compose up --build                    # frontend only (demo mode, no backend)
docker compose --profile curator up --build  # frontend + argus-curator
docker compose --profile lens    up --build  # frontend + argus-lens
docker compose --profile gallery up --build  # argus-quarry: acquire PD/CC0 images -> DATASET_DIR
docker compose --profile full    up --build  # whole suite
```

| Profile | Services started | Use it for |
|---|---|---|
| _(none)_ | frontend | Public captioning + read-only `/curate` demo |
| `curator` | frontend + argus-curator | Scanning / exporting datasets |
| `lens` | frontend + argus-lens | Captioning against a running engine |
| `gallery` | argus-quarry (run-to-completion job) | Acquiring PD/CC0 images with provenance into `DATASET_DIR` |
| `full` | frontend + curator + lens | End-to-end curate → caption (set `NEXT_PUBLIC_CURATOR_UI_MODE=live`) |

**argus-quarry** (the `gallery` profile) is the upstream producer: it fetches
public-domain / CC0 images from open archives with full provenance and licence
records, grouped into LoRA-training categories (`identity` / `wardrobe` /
`setting` / `concept`), and publishes a curator-ready `<category>/<subject>/`
tree into `DATASET_DIR`. Run it first, then curate the published images:

```bash
docker compose --profile gallery up --build   # fetch -> pool -> publish DATASET_DIR
docker compose --profile curator up --build   # then scan/curate on /curate
```

**NVIDIA GPUs** (optional, needs the NVIDIA Container Toolkit): layer the override so
the base stack still runs on CPU-only machines.

```bash
docker compose -f compose.yaml -f compose.gpu.yaml --profile full up --build
```

The only cross-service coupling is the **curate → caption handoff**: curator and lens
share the dataset at `/data/images` (`DATASET_DIR`) so lens can read the manifest's
`abs_path` entries and write `.txt` sidecars. The curator calls lens server-to-server at
`NEXT_PUBLIC_LENS_INTERNAL_URL` (the compose service DNS name, not `localhost`). Each
service still runs perfectly on its own.

### Run services individually

You can also run any piece outside Docker. Start the `argus-lens` server (in a separate terminal):

```bash
# In the argus-lens repo (PyPI install)
pip install argus-lens[server,local]
argus-lens serve --cors --port 8100
```

If you are developing **argus-lens locally**, rebuild the wheel and reinstall into the same environment you use for `serve` (the demo always talks to whatever is running on `NEXT_PUBLIC_API_URL`). Targets use [uv](https://docs.astral.sh/uv/) so installs work on PEP 668 (externally managed) system Pythons:

```bash
cd ../argus-lens
uv venv                 # once: create .venv in the repo
source .venv/bin/activate
make wheel-reinstall    # uv build + uv pip install --force-reinstall dist/*.whl[server,local,...]
argus-lens serve --cors --port 8100
```

Or use an editable install while hacking Python: `uv pip install -e ".[server,local]"` from the argus-lens repo (no wheel step).

### Caption page (`/`)

The caption page has five input modes (drag-and-drop works anywhere on the page —
images land in **Upload**, a `.jsonl` lands in **Curate manifest**):

- **Single URL** — paste an image URL for one structured caption (`POST /caption/url`).
- **Upload** — drag-and-drop (or browse) images from your machine; they stream through `POST /caption/stream` with per-image progress. A single image gets the full variant breakdown; multiple images run as a batch.
- **Local folder** — batch-caption every image in a server-side folder (`POST /caption/folder`), writing a `.txt` sidecar next to each image. The folder picker browses `GET /folders`, which requires a source root:

  ```bash
  argus-lens serve --cors --port 8100 --source-root /path/to/images
  # or: LENS_SOURCE_PATH=/path/to/images argus-lens serve --cors
  ```

  In the suite compose this is preset to `/data/images` (`DATASET_DIR`). You can also type a path manually if browsing is disabled.
- **Immich** — batch-caption an album on your [Immich](https://immich.app) photo server (`POST /immich/caption/stream`), optionally writing each caption back to the asset's description in Immich. Requires `IMMICH_URL` / `IMMICH_API_KEY` on the argus-lens server.
- **Curate manifest** — upload a `manifest.jsonl` produced by `/curate` (`POST /caption/manifest`); each row's `target_profile` is applied per image. Images must be reachable at their `abs_path` (the shared `/data/images` mount).

### Curator SPA (`/curate`)

The curator UI calls `NEXT_PUBLIC_CURATOR_URL` (default `http://localhost:8101`). Run the FastAPI app from [argus-curator](https://github.com/smk762/argus-curator) in another terminal.

In live mode the page also offers:

- **Add images to dataset** — drag-and-drop images into a folder under the shared dataset (`POST /upload` on the curator), or pull an Immich album into it via argus-lens (`POST /immich/pull`); the target folder is pre-filled for scanning.
- **Recent scans** — reopen a persisted scan (`GET /scan/{scan_id}`) without rescanning; history is kept in the browser.
- **Detector badges** — what the curator backend can actually do (`GET /detectors`: torch / cuda / clip / faces / onnx), so greyed-out options explain themselves.

PyPI install:

```bash
pip install "argus-curator[server,gpu]"
argus-curator serve --cors --port 8101
```

**Local wheel** (after `uv build` or `hatch build` in the argus-curator repo — you should see something like `dist/argus_curator-0.1.1.dev2+g…-py3-none-any.whl`):

```bash
cd ../argus-curator
source .venv/bin/activate    # or: uv venv && source .venv/bin/activate
uv build
WHEEL="$(ls -t dist/*.whl | head -1)"
uv pip install --force-reinstall "${WHEEL}[server,gpu]"
argus-curator serve --cors --port 8101
```

Use `"${WHEEL}[server]"` instead of `[server,gpu]` if you only need the HTTP API without optional GPU detectors and embeddings. Editable alternative: `uv pip install -e ".[server,gpu]"` from the argus-curator repo.

From **this** repo root (activate the same Python venv you use for `argus-curator serve`), reinstall the newest wheel without `cd` by pointing at the sibling `dist/` (build in argus-curator first so `dist/*.whl` exists):

```bash
WHEEL="$(ls -t ../argus-curator/dist/*.whl | head -1)"
uv pip install --force-reinstall "${WHEEL}[server,gpu]"
```

Then launch the demo frontend:

```bash
# Docker (recommended)
cp .env.example .env
docker compose up --build
```

```bash
# Or local dev
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (captioning) or [http://localhost:3000/curate](http://localhost:3000/curate) (curation).

## Architecture

```
argus-quarry (gallery profile, run-to-completion)
   └─ acquire PD/CC0 + provenance ──▶ /data/images (DATASET_DIR)

browser (:3000)  →  Next.js frontend
                         ├─ /caption/*, /immich/*  →  argus-lens (:8100)     →  captioning
                         └─ /scan, /upload, …      →  argus-curator (:8101)  →  curation API

curate → caption handoff ("full" profile):
   /curate export ── manifest ──▶  argus-lens /caption/manifest/stream
        └───────────── shared /data/images ─────────────┘

Immich (optional):  argus-lens ⇄ IMMICH_URL  (album captioning, write-back, pull-to-dataset)
```

Argus Studio is a thin frontend-only wrapper. It sends JSON requests to the `argus-lens` and `argus-curator` HTTP servers and renders results. No backend code lives in this repo — the suite `compose.yaml` builds the backends from their sibling repositories.

- **Frontend** — Next.js 15 (App Router) + Tailwind CSS v4, dark theme
- **Captioning server** — `argus-lens[server]` (see [argus-lens](https://github.com/smk762/argus-lens))
- **Curation server** — `argus-curator[server]` (optional `gpu` extra; see [argus-curator](https://github.com/smk762/argus-curator))

## Configuration

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8100` | URL the **browser** uses to reach the argus-lens API |
| `NEXT_PUBLIC_CURATOR_URL` | `http://localhost:8101` | URL the **browser** uses to reach the argus-curator API (`/curate`) |
| `NEXT_PUBLIC_CURATOR_UI_MODE` | `demo` | `demo` (bundled sample, no backend) or `live` (real scans/exports) |
| `NEXT_PUBLIC_CURATOR_SOURCE_PATH` | `/data/images` | Default source path shown in the folder picker (path inside the curator container) |
| `NEXT_PUBLIC_CURATOR_OUTPUT_PATH` | `/data/out` | Default export destination (path inside the curator container) |
| `NEXT_PUBLIC_LENS_INTERNAL_URL` | `http://argus-lens:8100` | URL the **curator container** uses to reach lens for the caption handoff (server-to-server) |
| `DATASET_DIR` | `./data` | Host dir mounted at `/data/images` on **both** curator and lens |
| `OUTPUT_DIR` | `./out` | Host dir mounted at `/data/out` on curator (exports) |
| `HF_CACHE_DIR` | `~/.cache/huggingface` | Host Hugging Face cache shared with the backends |
| `ARGUS_BACKEND` | `hybrid` | argus-lens captioning backend |
| `IMMICH_URL` / `IMMICH_API_KEY` | _(unset)_ | Enable the Immich integration on argus-lens (album captioning + pull-to-dataset) |
| `LENS_SOURCE_PATH` | `/data/images` | Root the caption page's folder picker browses on lens (`GET /folders`) |
| `LENS_EXTRAS` | `server,local` | pip extras baked into the standalone lens image (`server,openai,replicate` for cloud-only) |
| `FRONTEND_PORT` / `LENS_PORT` / `CURATOR_PORT` | `3000` / `8100` / `8101` | Host ports |

`NEXT_PUBLIC_*` values are inlined when the client bundle is built. After changing them in `.env`, run `docker compose build --no-cache` (or restart `npm run dev` locally) so the container image picks up the new values.

## Parameters

All captioning parameters are exposed in the UI with inline documentation:

| Parameter | Default | Description |
|---|---|---|
| `target_style` | `photo` | `photo` for realism models, `anime` for booru-tagged models |
| `target_backend` | `sdxl` | Diffusion backend — determines CLIP/T5 token budget (60–200 tokens) |
| `target_category` | `identity` | Which category variant becomes `final_caption` |
| `prose_enrichment` | `true` | Append novel prose-derived tokens to training variant at lowest priority |

## Related

- [argus-lens](https://github.com/smk762/argus-lens) — captioning engine, CLI, and server for the main page
- [argus-curator](https://github.com/smk762/argus-curator) — dataset curation CLI and HTTP server for `/curate`
- [argus-quarry](https://github.com/smk762/argus-quarry) — provenance-first PD/CC0 image acquisition (the `gallery` compose profile)

## License

MIT
