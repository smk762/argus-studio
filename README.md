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
git clone https://github.com/smk762/argus-forge ../argus-forge     # optional: forge profile
git clone https://github.com/smk762/argus-proof ../argus-proof     # optional: proof profile
# (this repo is argus-studio)
cp .env.example .env      # set DATASET_DIR / OUTPUT_DIR, choose UI mode, etc.
```

Then, from this repo root:

```bash
docker compose up --build                    # frontend only (demo mode, no backend)
docker compose --profile curator up --build  # frontend + argus-curator
docker compose --profile lens    up --build  # frontend + argus-lens
docker compose --profile gallery up --build  # argus-quarry: acquire PD/CC0 images -> DATASET_DIR
ARGUS_CURATOR_UI_MODE=live \
docker compose --profile forge   up --build  # frontend + curator + argus-forge (training configs)
docker compose --profile proof   up --build  # frontend + argus-proof (post-training LoRA evaluation)
docker compose --profile full    up --build  # whole suite
```

| Profile | Services started | Use it for |
|---|---|---|
| _(none)_ | frontend | Public captioning + read-only `/curate` demo |
| `curator` | frontend + argus-curator | Scanning / exporting datasets |
| `lens` | frontend + argus-lens | Captioning against a running engine |
| `gallery` | argus-quarry (acquisition job) + argus-quarry-server | Acquiring PD/CC0 images with provenance into `DATASET_DIR`, browsable at `/gallery` |
| `forge` | frontend + argus-curator + argus-forge | Turning `/curate` exports into ready-to-run LoRA training configs (kohya / OneTrainer / diffusers). Set `ARGUS_CURATOR_UI_MODE=live` — the forge step lives in the live-mode export flow |
| `proof` | frontend + argus-proof | Post-training LoRA evaluation ([epic](https://github.com/smk762/argus-studio/issues/6)): review scored eval runs at `/proof` — pass/fail verdict, per-metric scores, and a keyboard-first HITL review (5-star + structured reject reasons, blind mode) against argus-proof on :8104 |
| `full` | frontend + curator + lens + quarry server + forge + proof | End-to-end acquire → curate → caption → forge → evaluate (set `ARGUS_CURATOR_UI_MODE=live`) |

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
`abs_path` entries and write `.txt` sidecars. The curator calls lens
server-to-server at the compose service DNS name (`http://argus-lens:8100`), not
`localhost`. Each service still runs perfectly on its own.

### Run services individually

You can also run any piece outside Docker. Start the `argus-lens` server (in a separate terminal):

```bash
# In the argus-lens repo (PyPI install)
pip install argus-lens[server,local]
argus-lens serve --cors --port 8100
```

If you are developing **argus-lens locally**, rebuild the wheel and reinstall into the same environment you use for `serve` (the demo always talks to whatever is running on `ARGUS_LENS_URL`). Targets use [uv](https://docs.astral.sh/uv/) so installs work on PEP 668 (externally managed) system Pythons:

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

The curator UI calls `ARGUS_CURATOR_URL` (default `http://localhost:8101`). Run the FastAPI app from [argus-curator](https://github.com/smk762/argus-curator) in another terminal.

In live mode the page also offers:

- **Add images to dataset** — drag-and-drop images into a folder under the shared dataset (`POST /upload` on the curator), or pull an Immich album into it via argus-lens (`POST /immich/pull`); the target folder is pre-filled for scanning.
- **Recent scans** — reopen a persisted scan (`GET /scan/{scan_id}`) without rescanning; history is kept in the browser.
- **Detector badges** — what the curator backend can actually do (`GET /detectors`: torch / cuda / clip / faces / onnx), so greyed-out options explain themselves.
- **Forge training config** — after export (and captioning), [argus-forge](https://github.com/smk762/argus-forge) turns the export into a ready-to-run LoRA config for kohya sd-scripts, OneTrainer, or diffusers (`POST /config` on `ARGUS_FORGE_URL`, default `http://localhost:8103`), seeded from the same selection-insight heuristics the panel displays. Demo mode offers a client-side kohya TOML download instead. Two caveats when forge runs in Docker: the generated configs reference **container paths** (`/data/out/…`), so substitute your `OUTPUT_DIR` (and prefer `copy`-mode exports over `symlink`) when running `train.sh` on the host; and if you run forge outside compose, start it with `argus-forge serve --cors` so the browser can reach it.

### Gallery (`/gallery`)

A read-only view over [argus-quarry](https://github.com/smk762/argus-quarry)'s provenance database (`ARGUS_QUARRY_URL`, default `http://localhost:8102`): pool stats, licence/source/category/subject filters, thumbnails, and a per-image provenance card (source page, photographer, attribution, SHA256). Every photo links straight into `/curate` with its published subject folder preselected. Run the server with the `gallery` profile, or standalone:

```bash
pip install "argus-quarry[server]"
argus-quarry serve --cors --port 8102
```

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

### Proof (`/proof`)

Review post-training LoRA evaluation runs from [argus-proof](https://github.com/smk762/argus-proof) (`ARGUS_PROOF_URL`, default `http://localhost:8104`). A run browser lists scored runs; the selected run shows its pass/fail **verdict**, group-collapsed pass-rate, per-metric means (identity / adherence / quality / preference / safety), diversity, and scorer provenance. Below it is the **human-in-the-loop review**: a keyboard-first grid (`1`–`5` rate, `0` clear, arrows move) with a 5-star rating and a structured, multi-label reject taxonomy (deformation / decoherence / ID-not-applied / …) captured as structured codes, not free text. **Blind mode** hides each sample's checkpoint/weight/epoch/seed and randomises order to remove expectation bias, revealing provenance after you rate; the borderline (needs-review) band is surfaced first via the automated pre-pass. Saving folds the ratings + reasons + rater id back into the report and recomputes the verdict (`POST /report/{id}/hitl`). Demo mode reviews a bundled sample report with no backend; run the server with the `proof` profile, or standalone:

```bash
pip install "argus-proof[server]"
argus-proof serve --cors --port 8104
```

## Architecture

```
argus-quarry (gallery profile, run-to-completion)
   └─ acquire PD/CC0 + provenance ──▶ /data/images (DATASET_DIR)

browser (:3000)  →  Next.js frontend
                         ├─ /caption/*, /immich/*  →  argus-lens (:8100)          →  captioning
                         ├─ /scan, /upload, …      →  argus-curator (:8101)       →  curation API
                         ├─ /photos, /stats, …     →  argus-quarry-server (:8102) →  provenance (read-only)
                         ├─ /config                →  argus-forge (:8103)         →  training configs
                         └─ /reports, /report/*    →  argus-proof (:8104)         →  LoRA evaluation + HITL review

curate → caption → forge handoff ("full" profile):
   /curate export ── manifest ──▶  argus-lens /caption/manifest/stream
        └───────────── shared /data/images ─────────────┘
   then argus-forge /config reads the export (+ collects .txt sidecars)
        and writes kohya / OneTrainer / diffusers configs under <export>/forge/

Immich (optional):  argus-lens ⇄ IMMICH_URL  (album captioning, write-back, pull-to-dataset)
```

Argus Studio is a thin frontend-only wrapper. It sends JSON requests to the `argus-lens` and `argus-curator` HTTP servers and renders results. No backend code lives in this repo — the suite `compose.yaml` builds the backends from their sibling repositories.

- **Frontend** — Next.js 15 (App Router) + Tailwind CSS v4, dark theme
- **Captioning server** — `argus-lens[server]` (see [argus-lens](https://github.com/smk762/argus-lens))
- **Curation server** — `argus-curator[server]` (optional `gpu` extra; see [argus-curator](https://github.com/smk762/argus-curator))

## Configuration

| Variable | Default | Description |
|---|---|---|
| `ARGUS_LENS_URL` | `http://localhost:8100` | URL the **browser** uses to reach the argus-lens API |
| `ARGUS_CURATOR_URL` | `http://localhost:8101` | URL the **browser** uses to reach the argus-curator API (`/curate`) |
| `ARGUS_QUARRY_URL` | `http://localhost:8102` | URL the **browser** uses to reach the argus-quarry provenance API (`/gallery`) |
| `ARGUS_FORGE_URL` | `http://localhost:8103` | URL the **browser** uses to reach the argus-forge training bridge (ExportPanel forge step) |
| `ARGUS_PROOF_URL` | `http://localhost:8104` | URL the **browser** uses to reach argus-proof (the `/proof` eval-review view) |
| `ARGUS_CURATOR_UI_MODE` | `demo` | `demo` (bundled sample, no backend) or `live` (real scans/exports) |
| `ARGUS_CURATOR_SOURCE_PATH` | *(empty)* | Default source path shown in the folder picker (path inside the curator container). `compose.yaml` sets `/data/images` |
| `ARGUS_CURATOR_OUTPUT_PATH` | *(empty)* | Default export destination (path inside the curator container). `compose.yaml` sets `/data/out` |
| `DATASET_DIR` | `./data` | Host dir mounted at `/data/images` on **both** curator and lens |
| `OUTPUT_DIR` | `./out` | Host dir mounted at `/data/out` on curator (exports) |
| `HF_CACHE_DIR` | `~/.cache/huggingface` | Host Hugging Face cache shared with the backends |
| `ARGUS_BACKEND` | `hybrid` | argus-lens captioning backend |
| `IMMICH_URL` / `IMMICH_API_KEY` | _(unset)_ | Enable the Immich integration on argus-lens (album captioning + pull-to-dataset) |
| `LENS_SOURCE_PATH` | `/data/images` | Root the caption page's folder picker browses on lens (`GET /folders`) |
| `LENS_EXTRAS` | `server,local` | pip extras baked into the standalone lens image (`server,openai,replicate` for cloud-only) |
| `FRONTEND_PORT` / `LENS_PORT` / `CURATOR_PORT` | `3000` / `8100` / `8101` | Host ports |
| `QUARRY_SERVER_PORT` / `FORGE_PORT` / `PROOF_PORT` | `8102` / `8103` / `8104` | Host ports |

The `ARGUS_*` frontend variables are resolved **per request** from the container's
environment, not baked into the client bundle, so `docker compose up -d frontend`
applies a change without a rebuild — one published image deploys to any origin.

Behind a reverse proxy, give each service a **path prefix** on the proxy's origin:

```bash
ARGUS_CURATOR_URL=/api/curator   # browser calls /api/curator/scan/folder
ARGUS_LENS_URL=/api/lens
```

An **empty string** means the origin root (`/scan/folder` instead of
`http://host:8101/scan/folder`). That works for at most one backend: all five
services expose `/health`, curator and lens both expose `/folders`, and curator
and quarry both expose `/thumb`, so a shared root is ambiguous. Use prefixes when
more than one service sits behind the proxy.

The pre-existing `NEXT_PUBLIC_*` names are still honoured as a fallback for older
`.env` files. The one rename that is not a straight prefix swap:
`NEXT_PUBLIC_API_URL` is now `ARGUS_LENS_URL`.

The repo-root `.env` is read by **`docker compose`**. A host `npm run dev` does
not see it — put local overrides in `frontend/.env.local`.

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
- [argus-forge](https://github.com/smk762/argus-forge) — training bridge: curated exports → ready-to-run LoRA training configs (the `forge` profile)
- [argus-proof](https://github.com/smk762/argus-proof) — post-training LoRA evaluation and optimisation (the `proof` profile; [epic](https://github.com/smk762/argus-studio/issues/6))

## License

MIT
