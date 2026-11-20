# Changelog

All notable changes to argus-studio are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Each `v*` tag publishes `ghcr.io/smk762/argus-studio`.

## [Unreleased]

### Changed

- **Demo recordings and the curator wire pin move to each package's `dev` HEAD** (#250, #259). The static `/` caption is re-recorded on argus-lens 0.14.1.dev9 (`61d8c16`): the same flags, now with lens's factual `straightforward` prompt and reconcile checks, so the prose reads plainer. `/curate`'s scan is re-recorded on argus-curator 0.18.0 (`b94d89b`) over the kept 2026-11-18 images, against the same NudeNet and SingGuard servers as before, and finds exactly what it found before. The curator pin moves with it, adding `legacy_min_short_side` to `ScanSummary`. The GPU work of both runs was leased from argus-iris.

## [0.6.0] - 2026-11-19

### Added

- **`/curate` shows the SingGuard mode a scan ran in** (curator 0.17): fast, fast-slow, slow or cascade, under SingGuard in the facet rail, with a warning when SingGuard refused the mode and every check ran fast. The mode comes from the scan form's picker, or else from the curator's default (`ARGUS_CURATOR_SINGGUARD_THINKING`).
- **`/curate`'s scan form picks the SingGuard mode** (argus-curator#180). A Mode select under the SingGuard policy offers `/detectors.singguard_thinking_modes` (the host's allowed list), with the curator's default named on the first option and a note on what each mode costs. It appears only when the curator lists modes. A chosen mode is sent as `guard.thinking`, and refused before the scan starts on a curator whose `/health` lacks `guard_thinking`, which would run its own mode silently. Again restores the mode the scan ran in, and the form flags a mode the host doesn't allow (the curator would answer 422).

### Changed

- **Cortex, forge and proof wire pins move to their `dev` HEADs** (#259). `/proof` follows proof's wire 1.9: a **Likeness** bar (DINOv2 whole-image similarity to the references, for subjects face identity can't score) with its Learn entry, and each scorer's pinned weights (`model_file`, a short sha256) in the Scorers list. Likeness is left out of the client's composite, as proof's default gate weighs it 0, and reports from older proofs (no `likeness`, `model_file` or `gate`) still load. The curator pin stays at `252cfde` until its recording moves with it (#250).
- **Curator wire pin and demo recording move to `252cfde`** (curator 0.17.1.dev30, with argus-curator#180). The demo images were regenerated with `scripts/make_curator_sample.py` (the 2026-11-14 originals were not kept) and re-recorded; the scan finds what it found before (same rejects, clusters, near duplicate and ratings), and records `guard_config.thinking: cascade`.
- **Darkroom's image rule is checked on the rendered views** (#263). `recordImages.test.ts` renders the record view, the history row and the image tile for every fixture record and fails if a deleted, omitted, refused, failed or removed one has an `<img>`. Record views carry `data-outcome`, which a new Bombadil property reads, and `ImageTile` now asks `hasImage()` itself.

- **A delete cannot reach a backend without the user's confirmation** (#262). Every deleting or purging fetcher on `/curate`, `/darkroom` and `/proof` takes a one-use `Confirmed`, minted only by the browser's confirm dialog or the user's own click on a confirm button, and spends it before the request. Nothing changes for the user: the same questions are asked.

- **CLAUDE.md states what must never happen and what enforces each rule** (#255). New checks: ESLint refuses a literal `process.env.NAME`, a runtime-config accessor called at module scope and an HTML string written to the DOM; `writeGateCoverage.test.ts` finds every non-GET fetcher in `lib/*Api.ts` and fails one that runs no capability guard; `repoRules.test.ts` holds that only `compose.train.yaml` arms training, the release image takes no build-time config, `next.config.ts` pins no headers and dev mode reaches only the policy list.

- **Compose defaults to argus-proof 0.4.0, with safety scoring on.** Proof's `PROOF_NUDENET_URL` defaults to `http://host.docker.internal:8130`, argus-retina's shared NudeNet 640m on the compose host (an exposed score of at least 0.2 is unsafe; the report names the detector); set it empty to skip safety. Proof also gets the `ARGUS_GPU_*` variables and the lock mount lens and curator have, so `ARGUS_GPU_COORDINATOR=broker` moves its runs onto argus-iris too.

- **Compose defaults to argus-lens 0.13.0 and argus-curator 0.16.0** (`0.16.0-gpu` under `compose.gpu.yaml`). Both are on argus-cortex 0.6 and can lease the GPU from argus-iris, the suite's GPU broker. The curator wire pin stays where the daily `wire-drift` check holds it.
- **The argus-iris GPU broker.** Compose passes `ARGUS_GPU_BROKER_URL`, `ARGUS_GPU_BROKER_TOKEN`, `ARGUS_GPU_BROKER_FALLBACK` and each image's `ARGUS_GPU_TENANT_MANIFEST` to lens and curator, so `ARGUS_GPU_COORDINATOR=broker` in `.env` switches them to iris, with the lock file as the fallback. Lens also gets `ARGUS_ADMIN_TOKEN`, so iris can unload its model. `.env.example` shows them, with the URL as an IP (containers do not resolve LAN host names).
- Compose passes `LENS_TRUSTED_HOSTS` and `CURATOR_TRUSTED_HOSTS`: argus-cortex 0.6 refuses a same-host write by DNS name unless the host is named.

### Fixed

- **Twenty-three audit findings.**
  - `/` (caption): an Immich or manifest batch that finishes after the user switched tabs no longer shows its table or error in the new tab, and the `/forge` hand-off follows the sidecar setting the run started with.
  - `/atlas`: switching canvases hides the previous job until the new one loads, and a refresh of the old job no longer takes the selection back.
  - `/forge`: an empty `/trainers` answer clears the fallback trainer chips and hides the run panel.
  - `/gallery`: a subject is picked as category/folder, so two categories with the same folder name no longer mix in the grid; switching archives no longer shows the old archive's rows, and a saved slice plan is dropped once the archive, filters or target change.
  - `/proof`: purging the last run no longer leaves "Loading report…" on screen, and a demo board always applies a review locally.
  - `/darkroom`: a seed that would be rounded, negative or non-finite is refused, and a failed Refresh drops the stale `/health` so write actions turn off.
  - Tooltips stay while the trigger is focused or hovered (not only both), and Escape closes a hover-opened one from anywhere.
  - The folder picker survives a parent re-render with an inline fetcher and disables "Use this folder" while a navigation loads.
  - An Immich album's dataset folder now ends in a short album-id suffix and is capped at 200 bytes, so two albums never share a folder and a long non-Latin name still fits the filesystem. **Re-ingesting an album lands in a new folder name.**
  - The face-identity counts drop by the moved frames on every path, and the token-budget docs widget names the fragments it skipped.
  - The docs opsec gate fails on GitHub Actions when the denylist secret is missing (fork PRs opt out explicitly), and the concept registry test compares each key with its entry's id.
  - `scripts/record_curator_demo.py` stages the new thumbnails and swaps them in only once every one arrived.

- **Eight audit findings.**
  - `/curate`: reopening a cached scan loads every row, not only the first 10,000, so the keep-set, the export and the bulk deletes see the whole scan.
  - `/curate`: a scan option whose detector the curator lacks (FairFace, MiVOLO ages, one-person set, body ages, scenes, garments) is switched off, not just hidden, so a stale `true` no longer goes out with the scan.
  - `/curate`: while the ages are still coming, an exposed frame stays covered even on a set with an adult set age, and so does a frame whose nudity was not scored.
  - `/darkroom`: a proof handoff always lands on the server's defaults, never on the placeholder form.
  - `/darkroom`: a late pre-flight verdict no longer revives a finished, failed or cleared run.
  - `/proof`: a refinement save that outlasts its run no longer touches the next run's edits or saving state.
  - `scripts/bundle_atlas_demo.py` builds the bundle beside the old one and swaps it in once every job is written, and refuses an `--out` that overlaps a `--job`.

## [0.5.0] - 2026-11-15

### Added

- **Branch hand-offs** (#236, option 1). The numbered pipeline (1–7) stays the nav, and a stage that branches now says where it leads. `/darkroom` shows a "From here" row: **Train a new LoRA in Forge**, plus **Rig a face in Mask** and **Mint a provenance card in Assay** when `ARGUS_MASK_URL` / `ARGUS_ASSAY_URL` are set. Mask and Assay are standalone UIs, and Studio links to them rather than duplicating their pages. The branches are listed once, in `BRANCHES` in `lib/pipeline.ts`. The row replaces `/darkroom`'s single Assay sentence.
- **Live training on /forge** (#122). With argus-forge 0.2's run API, the Training section of `/forge`:
  - starts the config **Generate + write** put into the export (kohya or diffusers), after asking first in the page;
  - streams the run's log live, and follows its tail unless you scroll up;
  - cancels a run, again after asking;
  - lists the runs forge remembers, newest first, with status and elapsed time.

  The run list is readable on any reachable forge. Start and Cancel need `/health.training` to be `enabled`, and the client refuses them otherwise (#75). It also refuses a second run while one is training, because forge itself would start both on the same GPU.

  Training is opt-in through a new override, `compose.train.yaml`. It runs the `-train` image on the GPU with `ARGUS_FORGE_READONLY=0`, plus `init`, an 8 GB `/dev/shm` and a Hugging Face cache volume. It is separate from `compose.gpu.yaml`, so adding GPUs never arms training. The static demo and read-only deployments are unchanged.
- **Nightly Bombadil and leak checks** (#242). A new workflow, `bombadil-nightly.yml`, runs daily and on demand, with two jobs:
  - **Bombadil:** a 45-minute run of the PR spec that doesn't stop at the first violation. It tries to shrink the first violation to a shorter trace (experimental, allowed to fail) and uploads the trace.
  - **Leak check:** `scripts/check-leaks.mjs` follows every nav link with a few interactions on each page, 30 times over, and measures nodes, listeners, documents and heap after a forced garbage collection. Growth over its limits fails the job. On the current demo all four stay flat, and a deliberately planted listener leak fails within 5 rounds. It replaces Bombadil's own leak checks, which read the counts without a garbage collection and so flagged healthy pages.

  A failure opens one `bombadil` issue per violated property (or one for the leak check), or comments on the open one, so a repeat failure doesn't open a new issue each night.
- **Bombadil property-based UI tests** (#241, epic #240). A new CI job, `bombadil`, builds the static demo and runs [Bombadil](https://antithesishq.github.io/bombadil/) against it for 3 minutes. Bombadil clicks, types, scrolls, goes back, reloads and resizes the viewport at random, and checks `frontend/bombadil/spec.ts` in every state it reaches:
  - Bombadil's defaults: no uncaught exceptions, unhandled rejections, console errors or HTTP errors;
  - one `<main>` and at most one `h1` per page;
  - one demo badge in the header;
  - no sideways scroll at any width;
  - the theme is always light or dark, with the toggle in step;
  - the demo never says a backend is unreachable, and never sits on a spinner.

  A violation uploads a trace that can be replayed, and the job summary gives the replay command. The job doesn't block merging yet. `scripts/static-server.mjs` is the export server, now shared with `check-overflow.mjs`.
- **Link to argus-assay** (#157). `ARGUS_ASSAY_URL` adds Assay, argus-mint's own UI for card drafts, review and publishing, to the footer's suite links. It also adds a line on `/darkroom` ("Turn a released image into a provenance card: mint it in argus-assay"). Mint is a branch off Darkroom, not a pipeline stage, and Studio links to Assay instead of duplicating its pages. Empty means no link.
- **Delete runs on /proof in dev mode** (#229). With argus-proof 0.3.0 in dev mode (compose passes `DEVMODE` as `ARGUS_PROOF_DEVMODE`; `PROOF_DEVMODE=0` opts out), the run list offers "Delete this run" and "Delete all runs". Each asks first, in the page, and says that a report's review and refinement go with it. The controls appear only when proof lists the `purge` capability, and the client refuses the request otherwise.
- **Flux guidance on New evaluation** (#228). With a Flux base checkpoint (proof's rule: one under `flux/`), `/proof`'s New evaluation offers a Guidance field, empty for proof's default of 3.5, and notes the Flux sampling proof applies. Guidance is sent only for Flux, because proof 0.3.0 refuses it on the SDXL template.
- **Learn panel** (#39, with #34 and #42). The ⓘ beside a caption control or a proof report metric opens a side panel with that concept's explanation, an example, related concepts and a link to its full docs page. You stay in the tool, and the page stays usable while the panel is open. The text comes from the shared concept registry, which now also covers the tag ↔ prose balance and the six proof metrics. The proof metric labels and hints read from it too. A test fails if the code points at a concept the registry lacks, or a docs page stops rendering its own concept.
- **Sitemap and robots.txt** (#41). The static demo publishes `/sitemap.xml` (every tool page and Studio's docs pages, from the nav lists) and a `robots.txt` that points at it. A self-hosted server build can't know its public origin, so its sitemap is empty. The `/docs` description now says what's there: the captioning concepts, with suite docs on docs.dragonhound.dev.
- **Trusted Types dry run** (#198). `ARGUS_CSP=report-only` now adds `require-trusted-types-for 'script'`. A `default` policy, first in `<head>`, lets through only this origin's `/_next/static/chunks/*.js` script URLs, which are the two sinks Next's runtime and React use to load chunks. With it, a crawl of every page reports nothing. Anything else is reported, and enforce mode is unchanged.
- **Proof hands its models to Darkroom** (#199). From a passed proof report, "Open in Darkroom" carries the evaluated checkpoint and LoRAs (with weights) from the run manifest argus-proof serves (smk762/argus-proof#57). Darkroom selects them, matching by sha256 first and then by exact name. Anything not in its model list is named in a warning and left out, and the form keeps its own choice instead of falling back silently. An older proof without the manifest route, or a run whose directory is gone, still links to a plain `/darkroom`.
- **"Made with" line on every tool page** (#171). Each of the seven tool pages names the package behind its view, the version the page already knows (`/health` live, the recording in the demo), and the command that makes it. It links to the package's handbook page, PyPI project and GitHub repo. A page with no real version (demo samples, nothing reachable yet) names the package alone.
- **`ARGUS_FORGE_UI_MODE` and `ARGUS_PROOF_UI_MODE`** (#59). `/forge` and `/proof` took their live-or-sample mode from the curator's `ARGUS_CURATOR_UI_MODE`. A public demo that keeps curator on its sample (as argus-halo does) therefore showed bundled samples on both pages and never called its read-only forge and proof servers. Each page now has its own mode, defaulting to the curator's, so existing deployments are unchanged.
- **Filter batch captions by tag** (#118). Folder and manifest runs ask lens for its category buckets (`include_buckets`, lens 0.11), and upload runs already return them. When rows carry buckets, a sidebar beside the results lists each category's tags with counts. Ticking terms filters the table: any term within a category, every category with a selection. Copy and Download still export every row in the same JSONL format. An older lens ignores the flag and the results look as before.
- **Pick the caption backend per request** (#69). The caption page lists every backend lens has registered, its kind and whether it needs a GPU. Unavailable ones keep lens's reason, and ones the server won't switch to say so. On a lens with per-request selection (smk762/argus-lens#107), a "Caption backend" menu offers the server default plus the backends that are available and allowed, and every caption mode sends the pick. An older lens gets the list only. Compose passes `ARGUS_ALLOWED_BACKENDS`. Set it to `ARGUS_BACKEND` alone on a public or shared-GPU host, so visitors can't load another model.
- **Proof refinement on `/proof`** (#68). A collapsible Refinement panel under the review board lists the images that passed, best first, and lets a reviewer rank each 1–5 with a note, or retract a ranking. It saves through `POST /report/{id}/refine`, gated like the HITL save, and applies locally in the demo. The verdict and pass rate don't change, and the run list shows how many images are refined. A review that fails a refined image drops its refinement, as argus-proof does.
- **A docs opsec gate.** `npm test` fails if a `/docs` page names a private or link-local address, a home or host-mount path, an email address, or a term on the private denylist (the `DOCS_OPSEC_DENYLIST` secret).
- **The static demo deploys from CI** (`.github/workflows/deploy-demo.yml`). Every `dev` commit that passes CI is built with `build:static` and published to the Cloudflare Pages project `argus-studio` as production (`--branch main`), then smoke-checked. It needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets. Without them it builds and skips the upload.
- **A weekly external link check** (`npm run docs:links`, `.github/workflows/docs-links.yml`). Every external URL in the docs is checked weekly, and a link into the handbook must also land on its `#anchor`. A broken one opens or updates a tracking issue. It never runs on PRs, so a third party's outage can't block a merge.

### Fixed

- **Every page scrolled sideways at 600–879 px when the Dragonhound strip was a little wider than the screen** (dh-shared 1.2.6, smk762/dragonhound-site#15; Studio vendors 1.2.8, which also adds Mask and Quarry to the strip). The strip's visually hidden name and label escaped its scroll box. How wide the strip gets depends on fonts: CI's Chrome hit it at 604 px. Bombadil found it on #249.
- **Review fixes from the release sync (#248):**
  - `/proof`: a reloaded report clears the last applied review, so a stale copy no longer decides the verdict or the Darkroom hand-off.
  - `/forge` training runs: log lines are batched and rendered every 100 ms instead of once per line, and a newly started run is listed straight away without first reopening another run's log.
  - The Darkroom hand-off reads a blank LoRA weight as the default 1, not 0.
  - The Tooltip adds to an existing `aria-describedby` instead of replacing it.
  - On the caption page, an earlier folder run's error no longer appears after you switch to another tab.
- **ai-code-auditor batch (2026-11-15): 53 findings, 45 fixed, 8 already fixed or not a Studio bug.** Highlights:
  - CSV export neutralises formula-leading cells and quotes bare CRs.
  - The NDJSON reader cancels the stream on a bad line and flushes the UTF-8 decoder.
  - Darkroom: a refused pre-flight no longer stays "running", late stream events can't revive a finished run, Generate is blocked for a policy the server can't enforce, the CFG field only takes in-range values, the stream is aborted on unmount, and stale health is dropped when darkroom stops answering.
  - Curator: refused scan options show unchecked and aren't sent, attribute facet counts honour the confidence floor, filters the keep set drops are named, race shows its source (FairFace), a blocked tile can still be deselected, and the export hand-off uses the settings the run used.
  - Stale-request guards on `/atlas`, `/proof` and the caption folder run.
  - Clipboard copy reports failure.
  - Safari's modal click-outside fallback hit-tests the backdrop.
  - The demo scorer name is now `buffalo_l`.
  - Atlas bundling no longer leaks host paths when the inputs root is empty.
- **A malformed proof run manifest no longer crashes /proof.** The Darkroom handoff falls back to a plain `/darkroom` when a manifest has no checkpoint name, and skips nameless LoRAs.
- **Tooltips meet WCAG 1.4.13** (#197). The pointer can now rest on a tooltip without it closing, it stays open while the pointer is on the trigger or the bubble, and Escape still dismisses it. On `/curate`, the disabled-reason and action hints (scan, delete, stop, purge, export mode, policy picks, the select checkbox) moved off native `title` onto the shared Tooltip, so they show on keyboard focus and reach screen readers as descriptions. The export options' explanations are now focusable "i" hints. A second pass covers darkroom, proof and atlas:
  - darkroom's `Button` shows its `title` through the Tooltip;
  - policy summaries and backend notes become focusable "i" hints;
  - the age-estimate caveat reaches screen readers;
  - reject-reason and unsafe-category chips are described;
  - atlas's Fetch OSM / Bake / Cut PMTiles / Build controls say why they're disabled on focus;
  - curator's Face clustering and Crops toggles get accessible names.
- **The dataset size hint no longer calls every workable size the sweet spot.** 41 images for an identity LoRA read "in the ~15–30 sweet spot". Sizes inside the workable range but outside the ideal band now say "workable … the sweet spot is ~15–30".
- **The opsec check lets reserved example domains through** (`example.com`/`.net`/`.org`, `*.example`, `*.test`, `*.invalid`, `*.localhost`). Every other address is still refused.
- **Compose passes lens its hosted-backend keys** (`HF_TOKEN`, `NVIDIA_API_KEY`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`), so `ARGUS_BACKEND=hf-inference` or `nvidia-nim` works from `.env` with the published image. `openai` and `replicate` also need a source build with their extras. Compose no longer passes `ARGUS_API_KEY`, which lens stopped reading.
- **Compose passes the `minor-exposed` rule** to curator and darkroom: `ARGUS_CURATOR_MINOR_EXPOSED` and `DARKROOM_MINOR_EXPOSED` (both `frame` by default; `overlap` restores curator's box-overlap rule). Images older than smk762/argus-curator#153 and smk762/argus-darkroom#49 ignore it.
- `.env.example` no longer shows a private LAN address in the `ARGUS_OPENAI_COMPAT_BASE_URL` example; it uses `<LAN_HOST>`.

### Changed

- **argus-lens 0.12.0.** Compose pins `LENS_TAG=0.12.0`. Its per-request backend selection turns on the caption page's "Caption backend" menu (#216).
  - Lens now fences folder and manifest captioning to its source root. Curator exports land in `/data/out`, so compose's `LENS_SOURCE_PATH` default moves from `/data/images` to `/data`, keeping the curate → caption handoff working. Set it back to `/data/images` to keep captioning off the exports.
  - Single URL captions from private/LAN addresses are now refused by lens. Compose passes `LENS_URL_ALLOWED_HOSTS` (trusted hosts) and `LENS_URL_FETCH`.
- **argus-proof 0.3.0.** Compose pins `PROOF_TAG=0.3.0`, which serves `GET /report/{id}/manifest`, so the proof → darkroom handoff (#199) works out of the box. The proof wire pin moves to proof's `dev` at the v0.3.0 commit (wire 1.4). The generated types now require fields proof always sends, such as `refinement`, and the bundled sample report carries them.
- **The map-demo links point at Atlas** (https://atlas.dragonhound.dev/). The painted-map demo moved there from realms.dragonhound.dev, which is kept for the Realms minigame. The footer link reads "Atlas" (was "Realms"), and `/atlas` and the job view link and name atlas.dragonhound.dev. `REALMS_URL` is now `ATLAS_URL`.
- **The static demo's recordings come from each package's `dev` HEAD** (part of [#170](https://github.com/smk762/argus-studio/issues/170)). `/` replays an argus-lens 0.11.1.dev4 caption (was 0.10.0) of the same Knötel plate with the same models (`hybrid:ram+openai-compat`, qwen3-vl:2b-instruct prose, qwen3:4b-instruct refine). `/curate` replays an argus-curator 0.15.2.dev2 scan (was 0.15.0) of a regenerated synthetic set: `scripts/make_curator_sample.py` now holds the whole recipe (SDXL text renders, the InstantID identity pass, the group-shot face blend and the rejects), with its output in `public/curator-sample/generation.json`. The blurred reject now fails on blur, as 0.15.1 intended, and each person's frames form one face cluster. `frontend/schema/demo.json` records the `dev` commit and version behind each recording; `src/lib/demoRecordings.test.ts` fails when a recording, the record or curator's wire pin disagree, and `/curate`'s demo note reads the version from the recording. The daily `wire-drift` workflow now also keeps one *Demo recordings behind dev* issue, and holds curator's wire pin on its recorded commit until its schema changes. The `/proof` sample stays hand-shaped sample data, and the `/atlas` jobs stay a 0.3.0 recording.
- **Wire types follow each package's `dev` HEAD, not a release** (part of [#170](https://github.com/smk762/argus-studio/issues/170)). `frontend/schema/pins.json` records each schema's `dev` commit and the package version at that commit (cortex `0.5.1.dev26`, curator `0.15.2.dev2`, forge `0.2.1.dev7`, proof `0.2.3.dev14`) instead of a tag. The four schemas are byte-identical to the tags they replace (cortex v0.4.7, curator v0.15.0, forge v0.2.0, proof v0.2.2), so no generated type changed beyond its header. `npm run wire:pull` fetches at `dev` HEAD and takes service names (`-- curator`). A daily `wire-drift` workflow opens a `chore/wire-sync` PR when a package's `dev` moves on, or an issue when the pulled schema breaks the checks.
- **Setup and services and the package docs moved to the [Argus handbook](https://docs.dragonhound.dev/)** ([argus-handbook](https://github.com/smk762/argus-handbook), [#203](https://github.com/smk762/argus-studio/pull/203)) before release. Both were built here: the cross-package "Setup and services" section ([#172](https://github.com/smk762/argus-studio/issues/172): moderation, what to run for which UI, one page per external service) and each package's docs imported from its `dev` HEAD ([#170](https://github.com/smk762/argus-studio/issues/170)). Studio's old `/docs/setup/…` and `/docs/packages/…` paths redirect there (301), in the server build (`next.config.ts`) and the static demo (`public/_redirects`). Studio's `/docs` keeps the captioning concepts, whose lens references link the handbook, and its sidebar links the handbook under "Suite docs". The package-docs import (`docs:pull`, `docs:check`, `schema/docs.json`, the `docs-drift` workflow) and the service registry went with them.
- **Compose defaults to argus-curator 0.15.1** (`0.15.1-gpu` under `compose.gpu.yaml`; `CURATOR_TAG` still overrides). 0.15.1 measures blur on the image interior rather than its 1 px border. Its wire schema is byte-identical to v0.15.0, so the curator wire pin and generated types stay at v0.15.0. The `/curate` demo sample remains a 0.15.0 recording (see its PROVENANCE.md).
- **The `/curate` demo sample is a real argus-curator 0.15.0 scan of synthetic images.** The hand-written 14-image fixture with coloured placeholder tiles is replaced by a recording (`scripts/record_curator_demo.py`) of the curator scanning 14 SDXL images of two fictional people, a group shot and three deliberate rejects (blur, low resolution, 5:1 banner). The scan JSON and the curator's own WebP thumbnails are bundled under `public/curator-sample/`, and demo-mode thumbnails load them with explicit sizes. `public/curator-sample/PROVENANCE.md` lists the checkpoint, prompts, seeds and licences.
- **argus-sightline is on GHCR.** The `survey` profile now pulls `ghcr.io/smk762/argus-sightline:${SIGHTLINE_TAG:-0.1.1}` (was `0.1.0`, which was never published), so it no longer needs `compose.build.yaml`.
- **The release builds arm64 on a native arm runner instead of under QEMU.** Each architecture builds on its own runner (`ubuntu-24.04`, `ubuntu-24.04-arm`) and pushes by digest, and a final job tags the two as one multi-platform image. The v0.4.0 release died in the emulated arm64 `npm ci` (`qemu: uncaught target signal 4`) and hung to the job timeout. The build jobs now time out after 20 minutes.

## [0.4.0] - 2026-11-14

### Added

- **An optional `mask` compose profile and footer link.** It runs [argus-mask](https://github.com/smk762/argus-mask) `ghcr.io/smk762/argus-mask:${MASK_TAG:-0.2.0}`, the talking-face viewer, on loopback `:8109` (`MASK_PUBLISH`), with the faces from `MASK_ASSETS_DIR` mounted read-only. It isn't in `full`, uses no GPU (the `energy` driver by default; an Audio2Face server can be named with `MASK_A2F_URL`) and needs no database, since mask keeps its consent records as files under the assets directory. Mask is a standalone viewer, not a studio stage, so there is no new page: `ARGUS_MASK_URL` adds it to the footer's standalone links. `compose.build.yaml` builds `../argus-mask`.
- **The `concept` target category** ([#175](https://github.com/smk762/argus-studio/issues/175)), for style and visual-concept LoRAs. `/curate`, `/forge` and the docs widget offer it as Concept / Style. Its training params and set-size guide match argus-forge 0.2.0: 2000 target steps, dim 32 / alpha 16, and 30–60 images. `TargetProfile` and `TargetCategory` are now generated from argus-cortex's `taxonomy-schema.json`, pinned at v0.4.7, and the forge pin moves to v0.2.0. Lens has no `concept` caption category, so the hand-off asks it for `setting`. A curator older than the one that adds `concept` to its schema rejects a scan that uses it.
- **Every page is served with a nonce-based Content-Security-Policy** ([#165](https://github.com/smk762/argus-studio/pull/165)). A fresh nonce per request goes on Next's scripts and the layout's two inline scripts, with `'strict-dynamic'` for what they load, plus `object-src`, `base-uri` and `frame-ancestors` set to `'none'`. It doesn't restrict where the backends live. `ARGUS_CSP` picks `enforce` (the default), `report-only` or `off`; X-Frame-Options, nosniff and Referrer-Policy are sent in every mode.
- **Light and dark themes** ([#124](https://github.com/smk762/argus-studio/issues/124)), from argus-safelight. A toggle in the header cycles system, light and dark. With no choice the page follows the system preference, so a light-mode system now gets the light theme. A saved choice is applied by a boot script before the first paint, and another open tab follows it. The light set darkens the accents, since they are also used as text.
- **Footer links to the standalone demos** ([#124](https://github.com/smk762/argus-studio/issues/124)). `ARGUS_LIGHTBOX_URL`, `ARGUS_CULL_URL` and `ARGUS_SAFELIGHT_URL` are read through the runtime config. A UI left unset gets no link, and a value that isn't http(s) or a path is dropped.
- **A shared `Tooltip`** ([#124](https://github.com/smk762/argus-studio/issues/124)), from argus-cull, with an `Info` mark for labels. It opens on hover or keyboard focus, also around a disabled button, and Escape closes it. The theme toggle, darkroom's Check and Generate, darkroom's history filter and the gallery's year range use it. The other native `title`s stay for [#35](https://github.com/smk762/argus-studio/issues/35).
- **Dev mode can delete everything, on command.** `/curate` gets Delete rejected, because a rejected frame can't be selected and so had no way to be deleted. It needs `delete_any`, and the frames stay covered. With `DEVMODE=1`, compose now sets `ARGUS_DARKROOM_DEVMODE`, and `/darkroom` offers Delete record and Delete everything, which remove records as well as images. Each one asks first. `DARKROOM_DEVMODE=0` opts out.
- **`/darkroom`, guarded generation** ([#125](https://github.com/smk762/argus-studio/issues/125)). A new stage for [argus-darkroom](https://github.com/smk762/argus-darkroom) 0.1.1, ported from argus-safelight: compose a prompt, see the pre-flight verdict, generate over SSE, read what every guard said about the output, browse the records and download the archive. When `/health.read_only` is true, Check, Generate and Remove image are disabled and the client refuses to send them. A `darkroom` compose profile runs it on loopback, with `ARGUS_DARKROOM_URL` for the browser. It isn't in `full`, because darkroom won't start without a SingGuard and none is bundled. In demo mode with no darkroom answering, the page shows a bundled read-only sample. A passed report on `/proof` links to it.
- **`/curate` moderation panels** ([#110](https://github.com/smk762/argus-studio/issues/110)). The detail view shows NudeNet and EraX scores and each policy's SingGuard verdict, with its rules, pass and model. The grid can sort by exposure, with unscored frames last, and carries a shield per policy. The rail filters by content rating, verdict, rule and policy, and the keep-set preview sends those filters. A scan can pick a SingGuard policy and variants from `/detectors`, with their wording from `GET /guard/policies`. Rule names always come from the verdict, since a letter means different things under different policies. A passing frame any policy judged unsafe is now blurred until revealed.
- **`/curate` reads faces, scenes and garments** ([#111](https://github.com/smk762/argus-studio/issues/111)). A scan can ask for FairFace attributes, MiVOLO ages, the set's age for frames with no face ("Set: one person"), body ages, Places365 scenes and Fashionpedia garments. The rail filters on all of them the way the curator does, and the keep-set preview sends them. Readings show as text on the card and in the detail view, with the model that made them. A frame whose face detection failed says it is unchecked rather than faceless. The keep set can be capped and spread across scenes or outfits, which the curator does as it exports. A cluster chip whose representative the page doesn't hold now stays blurred.
- **`/curate` prefilter, crops and the new export options** ([#112](https://github.com/smk762/argus-studio/issues/112)). A scan can drop exposed, faceless or ageless frames before the late checks, and they stay in the scan as `prefilter:*` rejects. It can also crop frames, from `.crop.json` sidecars or the watermark detector, and every check then sees the cropped frame. A scan that cropped anything exports by copy only, and a detector that is down gets a readable refusal. An export can write XMP sidecars with names for each identity, carry sidecars and write `run_stats.json`, and its result reports them. A keep-set preview asks `POST /scan/{id}/select` what the facets would keep and can replace the selection with it. Compose passes `ARGUS_CURATOR_WATERMARK_URL`. Rows are stamped manifest 2.2.
- **The caption page shows each variant's token use, and any variant can be the final caption** ([#117](https://github.com/smk762/argus-studio/issues/117)). For a single image, each variant shows about how many tokens it uses against the budget from lens's `GET /profiles`, and warns when it runs over. The count is lens's own word-based estimate, not a tokenizer's. Use as final swaps the final caption on the page, and copy and the JSON and CSV exports follow it, with the JSON also recording lens's pick under `final_choice`. Lens has no endpoint for this, so nothing is sent or saved, and a new caption or a reload clears the choice. Batch results aren't covered.
- **`/gallery` detail views read the record itself** ([#121](https://github.com/smk762/argus-studio/issues/121)). Opening a photo or archive item fetches it from `GET /photos/{id}` or `GET /archives/{name}/items/{id}`, and `?photo=` and `?archive=&item=` link straight to one, including a quarantined or failed photo the grid doesn't list. Provenance links open only for http(s) URLs.
- **`/gallery` says when the pool is empty or not ready** ([#121](https://github.com/smk762/argus-studio/issues/121)). The Pool view reads quarry's `/ready`: on its 503 it stops calling the pool routes and shows a notice with Check again and a way into Sources, instead of a raw error. Quarry gives the same 503 for a missing and an unreadable database, so the notice covers both. A quarry without `/ready` behaves as before.
- **`/atlas` catches up with argus-atlas 0.3.0a1** ([#119](https://github.com/smk762/argus-studio/issues/119)). A labelled job can draw its place names over the canvas (`GET /jobs/{id}/labels`), and the job view shows per-stage timings. The job list badges chunks (`z/x/y`) and recipes. New canvas has a `resampling` control, marks `.vrt` DEMs and can fetch OSM layers through `POST /osm` when the server advertises `osm_allowed`. A collapsed panel shows `GET /doctor`. Compose mounts an optional `ATLAS_RECIPES_DIR` at `/data/recipes` for atlas's CLI. `tiles` is on the bake progress type, though `POST /bake/stream` doesn't send it yet.
- **`/proof` slices unsafe rejects by policy category** ([#120](https://github.com/smk762/argus-studio/issues/120)). `RejectReason` carries proof's `category`, an Unsafe reject offers proof's six policy categories, and the run header counts unsafe rejects per category. Proof's gate doesn't categorise its own `unsafe` rejects, so those show as Uncategorised until a reviewer files them. A category outside the six still shows, under its own slug.
- **`/curate` deletes source images** ([#113](https://github.com/smk762/argus-studio/issues/113)). Delete selected removes the chosen frames from disk after a confirm, which names any hidden by the current filters, and needs a curator started with `CURATOR_ALLOW_DELETE=1` (`/health.delete_any`). A separate action removes frames held as under 18 with exposure, which can't be selected and which curator always lets a client delete. Compose leaves the flag commented out, like `CURATOR_ALLOW_MOVE`.
- **The caption page explains how a caption was built** ([#116](https://github.com/smk762/argus-studio/issues/116)). A collapsed section traces the raw model output into lens's categories and then into any one variant, marking which fragments reached it. It says so when an LLM rewrite means a fragment may have been reworded rather than dropped.
- **The caption page shows what lens's LLM rewrite did** ([#115](https://github.com/smk762/argus-studio/issues/115)). Rewritten variants carry an LLM badge, and a panel gives the model and attempts, lists each rejected rewrite with its problems, and says when the rewrite failed or was skipped because the endpoint was unreachable.
- **Compose wires up curator's detectors** ([#114](https://github.com/smk762/argus-studio/issues/114)). A digest-pinned `nudenet` service starts with the `curator`, `forge` and `full` profiles, and curator's NudeNet check is on by default. The FairFace, MiVOLO, Places365 and Fashionpedia model paths are set, and EraX and SingGuard are optional through `.env`. `compose.gpu.yaml` now runs curator's `-gpu` image and shares the card with lens through a lock file (`ARGUS_GPU_COORDINATOR=lease`). `CURATOR_GPU=1` builds the CUDA image from source.
- **`/curate` reads its scan list from the curator** ([#109](https://github.com/smk762/argus-studio/issues/109)). Recent scans come from `GET /scans`, Again refills the form from that scan, and a cached scan can be deleted when the server advertises `scan_delete`. A move export drops the moved frames from the grid immediately, so their thumbs are not requested again. A curator without `GET /scans` keeps the browser's own list.
- **`/curate` fills the grid while a scan is still running** ([#108](https://github.com/smk762/argus-studio/issues/108)). Result batches land as they arrive, a frame still waiting on faces, nudity, or policy says so and stays covered until that check lands, and Stop and Purge call the curator's scan control. A curator that does not advertise `scan_control` leaves both inert. The watermark phase shows as "Finding watermarks".
- **Bundled Ollama for lens caption refinement**: an `ollama` service (pinned to 0.40.11, internal only) and a one-shot `ollama-pull` that fetches `${ARGUS_REFINE_MODEL:-qwen3:8b}` start with the `lens`/`full` profiles. Lens's `ARGUS_REFINE_BASE_URL` defaults to `http://ollama:11434/v1`, and `ARGUS_REFINE=off` is now passed through to opt out. Lens refines by default from smk762/argus-lens#72. GPU access for `ollama` is in `compose.gpu.yaml`, and its models live in the `argus-ollama` volume.
- The RAM++ checkpoint cache (`RAM_CACHE_DIR`, default `~/.cache/ram_plus`) is mounted into lens, so `ARGUS_BACKEND=hybrid:ram+florence2` doesn't re-download 3 GB when the container is recreated. `.env.example` recommends RAM++ over WD14 for photo libraries.
- Unit tests and a CI gate ([#64](https://github.com/smk762/argus-studio/issues/64)): vitest over `src/lib`'s pure logic (the curator export seam, capability readers, runtime config, proof review rollup, NDJSON reader, error formatting), and `.github/workflows/ci.yml` running lint, typecheck and the tests on every PR. `npm test` and `npm run typecheck` scripts.

### Changed

- **Compose defaults to each backend's current release** ([#126](https://github.com/smk762/argus-studio/issues/126)). No default image is `latest` any more: curator 0.15.0 (`0.15.0-gpu` under `compose.gpu.yaml`), lens 0.11.0, quarry 0.4.0, forge 0.2.0, proof 0.2.2, atlas 0.3.1, darkroom 0.2.0, survey 0.1.1, sightline 0.1.0 and Ollama 0.40.16. Every `*_TAG` still overrides. Things to know when upgrading:
  - Lens 0.11 allows only `http://localhost:3000` when `LENS_CORS_ORIGINS` is unset, and answers a write from any other origin with a 403. Set it for a LAN or public studio.
  - Quarry 0.4.0's archive index schema is 4. An older index shows as not indexed on `/gallery` until `archives index` rebuilds it, which takes about 30 s for PD12M.
  - With no `ARGUS_DARKROOM_WORKFLOW` set (compose doesn't set one), darkroom from 0.1.3 picks a template by the checkpoint's folder (`sdxl/`, `flux/`, `flux-klein/`, `sd35/`). A checkpoint outside those folders, or a negative prompt on a template without a `$negative` slot, is refused with a 400, and `/darkroom` shows its reason.
  - argus-sightline publishes no image yet, so the `survey` profile still needs `compose.build.yaml` for it.
- **The curator wire pin moves to v0.15.0.** Curator's schema now marks every field it always sends as required ([argus-curator#129](https://github.com/smk762/argus-curator/issues/129)). Studio's curator types use a new `Sparse` helper in `lib/wire.ts` to keep required only what they relied on before, so an older curator still type-checks as tolerated. `ImageResult` gains `primary_face_pitch` and `primary_face_roll`, and `ScanSummary` gains `reference_skipped`. The curator's `TargetProfile` now matches cortex's exactly. Studio's handoff rows are now manifest 2.3: each carries `primary_face` and the scan's `set_age`, as curator's own rows do.
- **README caught up with the code** ([#174](https://github.com/smk762/argus-studio/issues/174)). It now says Next.js 16 and describes `/curate`'s cached-scan list, export move and source deletes with their curator flags, and the detector badges as reported. It covers lens refinement being on by default through the bundled Ollama, the pinned default image tags, and `LENS_CORS_ORIGINS`. It gains a `/darkroom` section and documents `ARGUS_CSP` (with a reverse-proxy note), `DEVMODE` and `ARGUS_SIGHTLINE_URL`.
- **Thumbnail grids load their first row eagerly** ([#159](https://github.com/smk762/argus-studio/issues/159)). `/curate`, the `/gallery` pool and archive browser, and the `/proof` board no longer lazy-load the tiles on screen at load, which are the likeliest Largest Contentful Paint; tiles after the first row stay lazy, through `lib/imageLoading.ts`. The `/curate` detail view loads its image eagerly, and `/darkroom` history thumbnails are now lazy, so a long history no longer fetches every image up front.
- **`eslint-config-next` matches Next at 16.4.5**, which turns on the React Compiler lint rules. `/forge` drops two `useCallback`s and auto-inspects through `useEffectEvent`, `/curate` declares its filtered list before the code that uses it and starts the sample banner set, `ProofBoard` resets during render rather than in an effect, and an Immich error now clears when the retry succeeds rather than when it starts. Effects that only fetch keep a commented suppression.
- Curator and darkroom read SSE through one module, `lib/sse.ts` ([#124](https://github.com/smk762/argus-studio/issues/124)). Darkroom now releases its connection when a stream fails, and both accept a last frame with no closing blank line. A last frame cut off mid-JSON now reads as "ended without a result" rather than a parse error. NDJSON streams keep their own reader.
- `asError` throws an `ApiError` carrying the HTTP status, and `readError` returns FastAPI's `detail` as text ([#124](https://github.com/smk762/argus-studio/issues/124)). The caption page's URL path uses it, so a 422 no longer renders as `[object Object]`.
- Chips over `/curate` thumbnails sit on a surface backing, and the blur veils on `/curate` and `/darkroom` are heavier, so their text reads in either theme ([#124](https://github.com/smk762/argus-studio/issues/124)).
- **The curator, forge and proof clients take their types from the services' wire schemas** ([#123](https://github.com/smk762/argus-studio/issues/123)). `src/lib/generated/*.ts` is generated with `json-schema-to-typescript` from copies in `frontend/schema/`, pinned by tag and sha256 in `pins.json` (curator 0.14.1, forge 0.1.1, proof 0.2.2). CI fails when the output drifts from the pins (`npm run wire:check`). Types that deliberately tolerate more than a schema allows stay by hand, and `src/lib/wire.ts` fails typecheck if one stops fitting its schema. `TargetCategory` and `TargetStyle` stay by hand until [argus-cortex#29](https://github.com/smk762/argus-cortex/issues/29). Nothing changes at runtime.
- **`/curate` and `/darkroom` no longer offer SingGuard policies still under evaluation.** Both hide the `adult-*` variants, as curator asks of UIs until its evaluation picks one, and `adult` stays. `DEVMODE=1` (or `ARGUS_DEVMODE`) offers them all, and compose also passes it to curator as `CURATOR_DEVMODE`, so `/curate` can delete any scanned image. `CURATOR_DEVMODE=0` keeps the policies without the delete. A policy already in the form stays visible, so a refilled scan or a re-run can't use one nobody can see.
- Atlas's `POST /controls` and `POST /tiles` are gated in the client like every other write, on GDAL rather than `read_only`, so a read-only host still allows them.
- **`/curate` keeps rejected and exposed frames covered** ([#107](https://github.com/smk762/argus-studio/issues/107), [#129](https://github.com/smk762/argus-studio/issues/129)). A rejected frame stays blurred and cannot be revealed or selected, and that decision is made before any NudeNet score is read, so a missing score is never treated as clear. An under-18 face with exposure is the same. A passing frame at or above the exposed line, or one NudeNet failed to score, is blurred until revealed. The short-side slider starts at 512, exports no longer send `include_rejected`, and a selection that comes back smaller names each frame's reject reason.
- Backend writes are gated in the API clients instead of per component ([#75](https://github.com/smk762/argus-studio/issues/75)). Before sending, proof runs and reviews, curator exports (manifest major, export root, and move), writing forge configs, atlas bakes and quarry slice fetches each check the server's advertised capability, probing `/health` first if the page hasn't. A refused write throws `CapabilityRefused` with the reason and never reaches the server, so a new caller can't reintroduce a dead button or a raw 403.

### Fixed

- **Captioning a `/curate` export now reads the exported file** ([#148](https://github.com/smk762/argus-studio/issues/148)). Studio sent lens no `export_root`, so a copy export captioned the source: a cropped export got captions of the uncropped original, and the `.txt` files landed beside the sources. Copy and move exports now read from, and write into, the export. Symlink exports still caption the source, because lens follows the link. A lens that can't see the export folder now reports that rather than silently using the source.
- **`ATLAS_OVERPASS_URL` reaches argus-atlas** ([#149](https://github.com/smk762/argus-studio/issues/149)). Compose didn't forward it, so setting it in `.env` did nothing.
- A 409 from atlas's `POST /tiles` shows its reason as a notice and reloads the job, and a chunk whose crop failed says so up front instead of offering a cut that can't work.
- Picking an OSM extract on `/atlas` now fills the AOI. `osm.json` holds the bbox as text, which the form read as a list and dropped. An extract's `places` layer is no longer sent to `POST /controls`, which would have burnt it as a mask.
- **Next is updated to 16.4.5 for its security advisories.** 16.2.4 is affected by the critical and high advisories `npm audit` lists, and sharp and postcss came in through it. Production dependencies now audit clean.
- **A failed refetch after a move no longer leaves `/curate`'s counts wrong.** Passed, rejected and duplicate counts keep the rows a paged load never fetched, the reject reasons drop the moved frames, and a near-duplicate cluster left with one frame stops counting as a cluster.
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

[Unreleased]: https://github.com/smk762/argus-studio/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/smk762/argus-studio/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/smk762/argus-studio/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/smk762/argus-studio/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/smk762/argus-studio/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/smk762/argus-studio/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/smk762/argus-studio/releases/tag/v0.1.0
