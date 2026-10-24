# Changelog

All notable changes to argus-studio are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Each `v*` tag publishes `ghcr.io/smk762/argus-studio`.

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

[0.2.0]: https://github.com/smk762/argus-studio/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/smk762/argus-studio/releases/tag/v0.1.0
