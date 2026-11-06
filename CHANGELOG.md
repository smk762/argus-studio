# Changelog

All notable changes to argus-studio are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Each `v*` tag publishes `ghcr.io/smk762/argus-studio`.

## [Unreleased]

### Added

- **`/curate` deletes source images** ([#113](https://github.com/smk762/argus-studio/issues/113)). Delete selected removes the chosen frames from disk after a confirm, which names any hidden by the current filters, and needs a curator started with `CURATOR_ALLOW_DELETE=1` (`/health.delete_any`). A separate action removes frames held as under 18 with exposure, which can't be selected and which curator always lets a client delete. Compose leaves the flag commented out, like `CURATOR_ALLOW_MOVE`.
- **`/curate` reads its scan list from the curator** ([#109](https://github.com/smk762/argus-studio/issues/109)). Recent scans come from `GET /scans`, Again refills the form from that scan, and a cached scan can be deleted when the server advertises `scan_delete`. A move export drops the moved frames from the grid immediately, so their thumbs are not requested again. A curator without `GET /scans` keeps the browser's own list.
- **`/curate` fills the grid while a scan is still running** ([#108](https://github.com/smk762/argus-studio/issues/108)). Result batches land as they arrive, a frame still waiting on faces, nudity, or policy says so and stays covered until that check lands, and Stop and Purge call the curator's scan control. A curator that does not advertise `scan_control` leaves both inert. The watermark phase shows as "Finding watermarks".
- **Bundled Ollama for lens caption refinement**: an `ollama` service (pinned to 0.40.11, internal only) and a one-shot `ollama-pull` that fetches `${ARGUS_REFINE_MODEL:-qwen3:8b}` start with the `lens`/`full` profiles. Lens's `ARGUS_REFINE_BASE_URL` defaults to `http://ollama:11434/v1`, and `ARGUS_REFINE=off` is now passed through to opt out. Lens refines by default from smk762/argus-lens#72. GPU access for `ollama` is in `compose.gpu.yaml`, and its models live in the `argus-ollama` volume.
- The RAM++ checkpoint cache (`RAM_CACHE_DIR`, default `~/.cache/ram_plus`) is mounted into lens, so `ARGUS_BACKEND=hybrid:ram+florence2` doesn't re-download 3 GB when the container is recreated. `.env.example` recommends RAM++ over WD14 for photo libraries.
- Unit tests and a CI gate ([#64](https://github.com/smk762/argus-studio/issues/64)): vitest over `src/lib`'s pure logic (the curator export seam, capability readers, runtime config, proof review rollup, NDJSON reader, error formatting), and `.github/workflows/ci.yml` running lint, typecheck and the tests on every PR. `npm test` and `npm run typecheck` scripts.

### Changed

- **`/curate` keeps rejected and exposed frames covered** ([#107](https://github.com/smk762/argus-studio/issues/107), [#129](https://github.com/smk762/argus-studio/issues/129)). A rejected frame stays blurred and cannot be revealed or selected, and that decision is made before any NudeNet score is read, so a missing score is never treated as clear. An under-18 face with exposure is the same. A passing frame at or above the exposed line, or one NudeNet failed to score, is blurred until revealed. The short-side slider starts at 512, exports no longer send `include_rejected`, and a selection that comes back smaller names each frame's reject reason.
- Backend writes are gated in the API clients instead of per component ([#75](https://github.com/smk762/argus-studio/issues/75)). Before sending, proof runs and reviews, curator exports (manifest major, export root, and move), writing forge configs, atlas bakes and quarry slice fetches each check the server's advertised capability, probing `/health` first if the page hasn't. A refused write throws `CapabilityRefused` with the reason and never reaches the server, so a new caller can't reintroduce a dead button or a raw 403.

### Fixed

- **Captions came back empty for two categories** ([#102](https://github.com/smk762/argus-studio/issues/102)). The caption page offered `camera_framing` and `pose_gaze`, and the curate → caption handoff mapped curator's `pose_composition` to `pose_gaze`. Lens has neither category, and it captions an unknown category to an empty string, so folder mode wrote empty `.txt` sidecars. The page now offers lens's own categories from `GET /profiles`, falling back to lens 0.10's six. The handoff passes `pose_composition` through unchanged, and `pose_composition` shows as a normal variant instead of a "legacy alias".
- Lens requests match lens 0.7–0.10 ([#106](https://github.com/smk762/argus-studio/issues/106)):
  - The manifest endpoints no longer send hybrid-balance fields they ignore. They now take `xmp_overwrite` and an optional `export_root` input, which lets manifest 2.0 rows resolve after a move export.
  - The XMP toggle says it merges into an existing sidecar, and has a "Replace existing .xmp" option.
  - Upload captioning shows per-image error lines (such as replay misses) instead of treating them as captions.
- Lens writes are gated in the client like every other service's ([#105](https://github.com/smk762/argus-studio/issues/105)). Folder captioning and Immich pulls check `/health.source_root` before sending.
- `/curate` scan progress against curator ≥ 0.4 ([#103](https://github.com/smk762/argus-studio/issues/103)). The label no longer goes blank on the newer phases (`nsfw`, `erax`, `identities`, `prefilter`, `scenes`, `garments`, `guard`), and a phase newer than this client gets a readable fallback. A scan stopped through `POST /scan/{id}/cancel` or purge (`event: cancelled`) now says it was stopped instead of "Scan stream ended without a result". A GPU-lease timeout shows the server's `retry_after`.
- Compose pins `LENS_TAG=0.10.0` and `ATLAS_TAG=0.3.0a1` by default ([#104](https://github.com/smk762/argus-studio/issues/104)). Atlas only moves `latest` on final releases, so `latest` was an image older than 0.3.0a1. Lens's next release narrows CORS to `localhost:3000` and refuses cross-site writes, so it should be a deliberate bump. `LENS_CORS_ORIGINS` is now forwarded, ready for that release.
- A scheme-less API base such as `ARGUS_CURATOR_URL=curator:8101` now gets the startup warning it was meant to. `new URL()` parses `curator:` as a scheme, so the check passed it silently and the mistake only showed as `Failed to fetch` in the browser.
- `manifestMajor` refuses a leading-zero major (`"02.1"`) the way argus-forge does, instead of reading it as 2.

## [0.3.0] - 2026-10-24

### Added

- **`/gallery` → Sources** ([#95](https://github.com/smk762/argus-studio/pull/95)): browse, filter and slice two large public-domain datasets into quarry's pool without downloading them first: **PD12M** (12.4M CC0 / Public Domain Mark images from 640 institutions) and **Megalith-10m** (9.58M Flickr photos). A Pool | Sources switch sits at the top of `/gallery`, and `?view=sources` deep-links to Sources.
  - Filters:
    - caption terms (`"phrases"`, `-term`) and a separate exclude field;
    - institution or Flickr account, with facet counts;
    - licence;
    - minimum short side and orientation;
    - known-size-only;
    - **black & white / colour**, **medium** (photograph, painting, drawing, print, map, text, object) and a **year range**.

    The last three are read from captions; the year range says how few images are dated.
  - A paged grid with tick-to-select and a detail view.
  - A slice bar to pick category, subject folder and size, from the match set or the selection. With `QUARRY_ALLOW_FETCH=1` on quarry it fetches into the pool with streamed progress. Otherwise it downloads `slice.json` and shows `argus-quarry archives fetch slice.json`.
- Compose: the quarry server mounts `PUBLIC_DOMAIN_DIR` read-only, sets `QUARRY_PD12M_DIR` / `QUARRY_MEGALITH_DIR`, and forwards `QUARRY_ALLOW_FETCH` (off by default) and `QUARRY_MAX_GB`.

### Fixed

- `/gallery` no longer reports quarry as "not running" when only `/stats` fails. An empty or seeding pool returns 503 there, which hid Sources, the very view used to fill a new pool.

### Upgrading

- Needs **argus-quarry ≥ 0.3.0** for Sources; the Pool view works with older quarry. Archive the metadata with quarry's `scripts/fetch_public_domain_metadata.py`, set `PUBLIC_DOMAIN_DIR` in `.env`, pull the quarry image, then index once with `docker compose run --rm argus-quarry-server archives index`.

## [0.2.0] - 2026-10-24

### Added

- **`/atlas`, pipeline stage 6** ([#93](https://github.com/smk762/argus-studio/pull/93)): a page for [argus-atlas](https://github.com/smk762/argus-atlas) on :8105, which bakes a georeferenced fantasy-map overlay from real terrain. On the page you can:
  - Build a canvas from a DEM, an AOI and an optional OSM extract.
  - Compare each control with the painted map using an opacity slider.
  - Stream a bake with style presets.
  - Cut and download the PMTiles archive.
  - Read the GDAL provenance.

  The bake control is gated on the server's `/health.read_only`. Atlas joins the nav with a new blue accent. On `/proof`, a report whose verdict passed hands off to `/atlas` (from #89).
- **`argus-atlas` compose service** in the `atlas` and `full` profiles. It runs the published GHCR image, reads DEMs from `DEM_DIR` (mounted at `/data/dem`), writes jobs under `OUTPUT_DIR/atlas`, and mounts `MODELS_DIR` read-only. Baking (`ATLAS_ALLOW_BAKE`) and server-side OSM fetches (`ATLAS_ALLOW_OSM`) are off by default. There is a matching `compose.build.yaml` entry for source builds.
- **`ARGUS_ATLAS_URL`** (default `http://localhost:8105`), resolved per request like the other service URLs.
- **`training_prose` caption variant** ([#92](https://github.com/smk762/argus-studio/pull/92)): shown under `training` on the caption page. It is the sentence-form caption that argus-lens returns for T5 targets (Flux, SD3).
- **Caption result docs** (from #90): what a result contains (`metadata.subjects`, `buckets`, `refine`), one Configuration row per lens variable, and a link to lens's curate-index workflow.
- **Headcount on the caption page** from lens's `metadata.subjects`. A multi-person image, or one where tags and prose disagree on the count, is flagged for face ID in `/curate`.
- **Lens server settings forwarded by compose:**
  - `ARGUS_OPENAI_COMPAT_*`, for WD14 tags plus prose from Ollama with `hybrid:wd14+openai-compat`.
  - `WD14_MODEL_REPO`.
  - `ARGUS_REFINE_*`, for validated LLM rewrites.
  - `ARGUS_IDLE_UNLOAD_S` and `ARGUS_GPU_COORDINATOR`, for sharing a GPU with ComfyUI.

  Lens also gets a WD14 cache mount (`WD14_CACHE_DIR`) and `host.docker.internal`.
- **`ATLAS_CORS_ORIGINS` forwarding**, alongside `CURATOR_CORS_ORIGINS` and `FORGE_CORS_ORIGINS` for browsing from a LAN origin ([#87](https://github.com/smk762/argus-studio/pull/87)).

### Fixed

- `/forge` no longer says a host "needs a GPU" when training is off. The `training` capability is argus-forge's server posture, not a hardware probe ([#88](https://github.com/smk762/argus-studio/pull/88)).
- The README's local lens build uses `uv build` + install; `make wheel-reinstall` was never a lens Makefile target.
- The argus-quarry acquisition job sets `DATASET_DIR` inside its container, so `--export` lands on the mounted volume instead of the container filesystem ([#86](https://github.com/smk762/argus-studio/pull/86)).

### Security

- The frontend image is built on `node:22.23.4-alpine`, which rejects certificate chains containing the compromised eMudhra intermediates. A cached floating `node:22-alpine` tag could stay on a pre-incident digest ([#91](https://github.com/smk762/argus-studio/pull/91)).

### Upgrading

- Copy the new `ARGUS_ATLAS_URL`, `ATLAS_*`, `DEM_DIR` and `ATLAS_PORT` entries from `.env.example` if you run the `atlas` or `full` profile. `--profile full` now also starts `argus-atlas` on :8105.
- The lens settings are optional; unset values keep the previous behaviour. The `training_prose` variant and headcount need argus-lens ≥ 0.6 (argus-lens#53); against an older lens they don't appear.

## [0.1.0] - 2026-07-23

First published image. It covers the caption page (`/`), curation (`/curate`), the provenance gallery (`/gallery`), training configs (`/forge`) and LoRA evaluation with HITL review (`/proof`), plus the `/docs` handbook. The suite `compose.yaml` runs the backends from published GHCR images, and API config is resolved at runtime rather than baked into the bundle (#71).

[0.3.0]: https://github.com/smk762/argus-studio/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/smk762/argus-studio/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/smk762/argus-studio/releases/tag/v0.1.0
