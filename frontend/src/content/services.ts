/**
 * The external services the Argus packages depend on (argus-studio#172), one
 * entry per /docs/setup/services/<id> page. The sidebar, the section index and
 * each page's facts block read from here, and scripts/check-links.mjs checks
 * every URL in it on a schedule.
 *
 * `config` names the exact env vars and flags each package reads at its `dev`
 * HEAD. The packages stay the source of truth: `docs` links to the section
 * that owns the detail. Hosts are `<GPU_HOST>` / `<LAN_HOST>` placeholders only
 * (the opsec gate in lib/docsOpsec.ts refuses anything else).
 */

export interface ServiceUser {
  /** Package (or UI) name, e.g. `argus-darkroom`. */
  pkg: string;
  /** What it uses the service for: short markdown. */
  role: string;
  /** Env vars, flags or extras it reads, rendered as code. */
  config: string[];
  /** The package doc section that owns the detail. */
  docs?: string;
}

export interface ServiceGuide {
  label: string;
  url: string;
  note?: string;
}

export interface Service {
  id: string;
  title: string;
  /** One or two sentences of markdown, shown at the top of the page. */
  summary: string;
  usedBy: ServiceUser[];
  guides: ServiceGuide[];
}

const gh = (repo: string, path = "README.md", anchor = "") =>
  `https://github.com/smk762/${repo}/blob/dev/${path}${anchor ? `#${anchor}` : ""}`;

export const SERVICES: Service[] = [
  {
    id: "gpu-host",
    title: "GPU host",
    summary:
      "An NVIDIA GPU with the driver and CUDA, Docker, and the NVIDIA Container Toolkit so containers can reach it. Local captioning, curator's GPU image, ComfyUI renders and forge training all run here. Several services can share one GPU through cortex's lease.",
    usedBy: [
      {
        pkg: "argus-lens",
        role: "Local backends (`wd14-gpu`, RAM++, Florence-2, BLIP-2), and models unloaded when idle.",
        config: ["[wd14-gpu]", "[local]", "ARGUS_MODEL_IDLE_SECONDS", "ARGUS_GPU_MIN_VRAM_MB"],
        docs: gh("argus-lens", "README.md", "gpu-prerequisites"),
      },
      {
        pkg: "argus-curator",
        role: "The `latest-gpu` image (CUDA 13 wheels, so the driver must support CUDA 13).",
        config: ["CURATOR_GPU", "[gpu]"],
        docs: gh("argus-curator", "docs/gpu.md"),
      },
      {
        pkg: "argus-forge",
        role: "`POST /run` in the `-train` image (torch on CUDA 12.4, kohya sd-scripts). Run it with `--gpus all --shm-size=8g`.",
        config: ["ARGUS_FORGE_READONLY=0", "FORGE_BUILD_TARGET=train"],
        docs: gh("argus-forge", "README.md", "training-image--train"),
      },
      {
        pkg: "argus-darkroom, argus-atlas",
        role: "Nothing in the package itself: they render through [ComfyUI](/docs/setup/services/comfyui), which needs the GPU.",
        config: [],
      },
      {
        pkg: "argus-cortex",
        role: "`argus_cortex.gpu`: a file lease so services sharing a GPU take turns. Every container mounts the same lock directory.",
        config: ["ARGUS_GPU_COORDINATOR=lease", "ARGUS_GPU_LEASE_PATH", "ARGUS_GPU_LEASE_TIMEOUT_S", "ARGUS_GPU_DEVICE", "[gpu]"],
        docs: gh("argus-cortex", "README.md", "whats-here"),
      },
      {
        pkg: "argus-studio",
        role: "`compose.gpu.yaml` reserves GPUs for lens, Ollama and curator, swaps in curator's `-gpu` image and turns the lease on.",
        config: ["-f compose.gpu.yaml", "ARGUS_GPU_LOCK_DIR"],
        docs: gh("argus-studio", "README.md", "quick-start"),
      },
    ],
    guides: [
      { label: "NVIDIA CUDA installation guide for Linux", url: "https://docs.nvidia.com/cuda/cuda-installation-guide-linux/" },
      { label: "Install Docker Engine", url: "https://docs.docker.com/engine/install/" },
      {
        label: "NVIDIA Container Toolkit install guide",
        url: "https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html",
      },
      { label: "GPU support in Docker Compose", url: "https://docs.docker.com/compose/how-tos/gpu-support/" },
    ],
  },
  {
    id: "comfyui",
    title: "ComfyUI",
    summary:
      "The image renderer behind darkroom, atlas bakes and proof's evaluation runs. Darkroom needs a websocket output node and two of its own custom nodes, which a stock install lacks.",
    usedBy: [
      {
        pkg: "argus-darkroom",
        role: "**Required.** Every generation. Needs `SaveImageWebsocket`, plus darkroom's custom nodes for image-to-image and inpainting.",
        config: ["ARGUS_DARKROOM_COMFYUI_URL", "ARGUS_DARKROOM_WORKFLOW"],
        docs: gh("argus-darkroom", "README.md", "comfyui-the-saveimagewebsocket-node"),
      },
      {
        pkg: "argus-atlas",
        role: "`bake`: the map restyle (off unless `ATLAS_ALLOW_BAKE=1`).",
        config: ["COMFYUI_BASE_URL", "--comfyui-url", "ATLAS_BACKEND=comfyui", "ATLAS_WORKFLOW", "ATLAS_ALLOW_BAKE"],
        docs: gh("argus-atlas", "README.md", "the-comfyui-workflow-template"),
      },
      {
        pkg: "argus-proof",
        role: "Renders the evaluation prompts with the trained LoRA (the default backend).",
        config: ["PROOF_BACKEND=comfyui", "COMFYUI_BASE_URL", "PROOF_WORKFLOW_TEMPLATE"],
        docs: gh("argus-proof", "README.md", "generation-backend"),
      },
      {
        pkg: "argus-forge",
        role: "Trained LoRAs land in `<export>/forge/kohya/output/`. Point that volume or `FORGE_PATH_MAP` at ComfyUI's `models/loras/`.",
        config: ["FORGE_PATH_MAP"],
        docs: gh("argus-forge", "README.md", "container--host-paths-path_map"),
      },
      {
        pkg: "argus-mint",
        role: "Renders through argus-darkroom, so indirectly.",
        config: ["ARGUS_MINT_DARKROOM_URL"],
        docs: gh("argus-mint", "README.md", "running-the-service"),
      },
    ],
    guides: [
      { label: "ComfyUI on GitHub", url: "https://github.com/Comfy-Org/ComfyUI" },
      { label: "System requirements", url: "https://docs.comfy.org/installation/system_requirements" },
      { label: "Manual install", url: "https://docs.comfy.org/installation/manual_install", note: "also the `models/` folder layout" },
      { label: "Custom nodes", url: "https://docs.comfy.org/basic-concepts/custom-nodes" },
    ],
  },
  {
    id: "ollama",
    title: "Ollama",
    summary:
      "A local LLM server. Lens writes and refines captions through it. Darkroom can expand prompts with it. The SingGuard guard server runs its model on it.",
    usedBy: [
      {
        pkg: "argus-lens",
        role: "The `openai-compat` caption backend and the refine pass. Both default to Ollama's OpenAI-compatible endpoint on localhost.",
        config: ["ARGUS_OPENAI_COMPAT_BASE_URL", "ARGUS_OPENAI_COMPAT_MODEL", "ARGUS_REFINE_BASE_URL", "ARGUS_REFINE_MODEL"],
        docs: gh("argus-lens", "README.md", "openai-compatible-vlms-prompt-presets"),
      },
      {
        pkg: "argus-darkroom",
        role: "Optional `--expand` prompt expansion. Uses Ollama's **native** `/api/chat`, so vLLM and LM Studio won't work here.",
        config: ["ARGUS_DARKROOM_OLLAMA_URL", "ARGUS_DARKROOM_OLLAMA_MODEL", "--expand"],
        docs: gh("argus-darkroom", "README.md", "configuration"),
      },
      {
        pkg: "SingGuard guard server",
        role: "Loads the SingGuard GGUF from Hugging Face. See [SingGuard](/docs/setup/services/singguard).",
        config: ["OLLAMA_URL", "GUARD_MODEL"],
      },
      {
        pkg: "argus-studio",
        role: "The `lens` and `full` profiles run a bundled Ollama and pull lens's refine model.",
        config: ["OLLAMA_TAG"],
        docs: gh("argus-studio", "README.md", "quick-start"),
      },
    ],
    guides: [
      { label: "Download Ollama", url: "https://ollama.com/download" },
      { label: "Ollama on Linux", url: "https://docs.ollama.com/linux" },
      { label: "Ollama in Docker", url: "https://docs.ollama.com/docker" },
      { label: "OpenAI compatibility", url: "https://docs.ollama.com/api/openai-compatibility" },
      { label: "Run a Hugging Face GGUF in Ollama", url: "https://huggingface.co/docs/hub/ollama" },
    ],
  },
  {
    id: "openai-compatible",
    title: "vLLM and other OpenAI-compatible servers",
    summary:
      "Any server that speaks the OpenAI chat API (vLLM, LM Studio, Ollama) can write lens's prose captions. Lens supports it alone, or after a local tagger as `hybrid:<tagger>+openai-compat`.",
    usedBy: [
      {
        pkg: "argus-lens",
        role: "`openai-compat` and `hybrid:*+openai-compat` backends. Default model `llava`, at `http://localhost:11434/v1`.",
        config: [
          "ARGUS_OPENAI_COMPAT_BASE_URL",
          "ARGUS_OPENAI_COMPAT_MODEL",
          "ARGUS_OPENAI_COMPAT_API_KEY",
          "ARGUS_OPENAI_COMPAT_PROMPT",
          "--base-url",
          "--model-id",
        ],
        docs: gh("argus-lens", "README.md", "openai-compatible-vlms-prompt-presets"),
      },
      {
        pkg: "argus-mint",
        role: "The card bio writer (an OpenAI-style chat endpoint).",
        config: ["ARGUS_MINT_WRITER_URL", "ARGUS_MINT_WRITER_KEY"],
        docs: gh("argus-mint", "README.md", "making-a-card-draft-review-publish"),
      },
    ],
    guides: [
      { label: "vLLM installation", url: "https://docs.vllm.ai/en/latest/getting_started/installation/" },
      { label: "vLLM OpenAI-compatible server", url: "https://docs.vllm.ai/en/latest/serving/openai_compatible_server/" },
      { label: "LM Studio OpenAI compatibility", url: "https://lmstudio.ai/docs/developer/openai-compat" },
    ],
  },
  {
    id: "hosted-apis",
    title: "Hosted inference APIs",
    summary:
      "Cloud captioning with no local GPU: OpenAI, Hugging Face Inference Providers, Replicate and NVIDIA NIM. Each needs an API key, and each request sends the image to that provider.",
    usedBy: [
      {
        pkg: "argus-lens",
        role: "Cloud backends: `openai` (`gpt-4o`), `hf-inference` (BLIP-2), `replicate` (Florence-2 large), `nvidia-nim` (Kosmos-2).",
        config: ["OPENAI_API_KEY", "HF_TOKEN", "REPLICATE_API_TOKEN", "NVIDIA_API_KEY", "[openai]", "[replicate]"],
        docs: gh("argus-lens", "README.md", "installation"),
      },
      {
        pkg: "argus-cortex",
        role: "`RemoteProvider` names the providers. It reads no env: the key is passed in.",
        config: ["[remote]"],
        docs: gh("argus-cortex", "README.md", "whats-here"),
      },
    ],
    guides: [
      { label: "OpenAI API quickstart", url: "https://developers.openai.com/api/docs/quickstart" },
      { label: "Hugging Face Inference Providers", url: "https://huggingface.co/docs/inference-providers/index" },
      { label: "Replicate docs", url: "https://replicate.com/docs" },
      { label: "NVIDIA NIM APIs", url: "https://docs.api.nvidia.com/nim/docs/introduction" },
    ],
  },
  {
    id: "nudenet",
    title: "NudeNet server",
    summary:
      "Per-body-part exposure scores over HTTP (`POST /infer`). The suite's exposed score is computed from its answer. See [Moderation](/docs/setup/moderation#the-exposed-score). NudeNet is AGPL-3.0, which is why it stays behind HTTP rather than being imported.",
    usedBy: [
      {
        pkg: "argus-curator",
        role: "Scan filters, `drop_nsfw`, and the under-18 rule.",
        config: ["ARGUS_CURATOR_NUDENET_URL", "ARGUS_CURATOR_NUDENET_TIMEOUT", "ARGUS_CURATOR_NUDENET_WORKERS", "--nudenet-url"],
        docs: gh("argus-curator", "docs/nudity.md", "configuration"),
      },
      {
        pkg: "argus-darkroom",
        role: "Output scan: blur or omit. Empty means SFW generation is refused.",
        config: ["ARGUS_DARKROOM_NUDENET_URL"],
        docs: gh("argus-darkroom", "README.md", "configuration"),
      },
      {
        pkg: "argus-proof",
        role: "`SafetyScorer`. Without a URL the scorer is skipped.",
        config: ["PROOF_NUDENET_URL", "PROOF_NUDENET_TIMEOUT"],
        docs: gh("argus-proof", "README.md", "scoring"),
      },
      {
        pkg: "argus-cortex",
        role: "`NudeNetClient`, `DEFAULT_EXPOSED_LABELS`, `exposed_score`.",
        config: [],
        docs: gh("argus-cortex", "README.md", "whats-here"),
      },
    ],
    guides: [{ label: "NudeNet on GitHub", url: "https://github.com/notAI-tech/NudeNet" }],
  },
  {
    id: "singguard",
    title: "SingGuard guard server",
    summary:
      "Judges an image or a prompt against a written policy and returns a verdict and the rule that fired. Darkroom will not start without one. The server is agent-composer's `/api/guard/check`, running the SingGuard model on Ollama.",
    usedBy: [
      {
        pkg: "argus-darkroom",
        role: "**Required.** Pre-flight (text-only) and per-policy image scans. Default mode `cascade`.",
        config: ["ARGUS_DARKROOM_SINGGUARD_URL", "ARGUS_DARKROOM_THINKING", "--thinking"],
        docs: gh("argus-darkroom", "README.md", "configuration"),
      },
      {
        pkg: "argus-curator",
        role: "Policy check and `--guard-*` scan filters. Off when the URL is unset.",
        config: [
          "ARGUS_CURATOR_SINGGUARD_URL",
          "ARGUS_CURATOR_SINGGUARD_THINKING",
          "ARGUS_CURATOR_SINGGUARD_POLICY_FILE",
          "ARGUS_CURATOR_SINGGUARD_CONTEXT",
          "ARGUS_CURATOR_SINGGUARD_TIMEOUT",
          "ARGUS_CURATOR_SINGGUARD_WORKERS",
        ],
        docs: gh("argus-curator", "docs/policy-check.md", "configuration"),
      },
      {
        pkg: "argus-cortex",
        role: "`SingGuardClient`, `GuardResult`, `THINKING_MODES`, and the policy texts.",
        config: [],
        docs: gh("argus-cortex", "README.md", "whats-here"),
      },
    ],
    guides: [
      { label: "SingGuard-4b GGUF (model card)", url: "https://huggingface.co/inclusionAI/SingGuard-4b-GGUF" },
      { label: "agent-composer (the guard server)", url: "https://github.com/smk762/agent-composer" },
    ],
  },
  {
    id: "erax-nsfw",
    title: "EraX-NSFW",
    summary:
      "A second nudity detector, served as a sidecar with NudeNet's `/infer` API. Curator uses it to fill in when NudeNet finds no exposed parts or fails.",
    usedBy: [
      {
        pkg: "argus-curator",
        role: "Fallback for the exposed score (`erax_filled: true`). Off when the URL is empty.",
        config: ["ARGUS_CURATOR_ERAX_URL", "ARGUS_CURATOR_ERAX_TIMEOUT", "ARGUS_CURATOR_ERAX_WORKERS", "--erax-url"],
        docs: gh("argus-curator", "docs/nudity.md", "erax-a-second-detector"),
      },
    ],
    guides: [{ label: "EraX-NSFW-V1.0 (model card)", url: "https://huggingface.co/erax-ai/EraX-NSFW-V1.0" }],
  },
  {
    id: "mivolo",
    title: "MiVOLO v2 (age estimate)",
    summary:
      "Estimates age per face and body. It feeds the `minor-exposed` rule. Curator converts it to ONNX with `argus-curator mivolo-convert`. The estimate is an automated guess: see [the limits](/docs/setup/moderation#the-limits).",
    usedBy: [
      {
        pkg: "argus-curator",
        role: "Face attributes and the `minor-exposed` hard exclusion.",
        config: ["ARGUS_CURATOR_MIVOLO_MODEL", "--mivolo-model", "mivolo-convert", "[mivolo-convert]"],
        docs: gh("argus-curator", "docs/face-attributes.md", "installing-the-model"),
      },
      {
        pkg: "argus-darkroom",
        role: "Age check through curator's `POST /faces?body=true`, or in process with the `[age]` extra.",
        config: ["ARGUS_DARKROOM_AGE_URL", "[age]"],
        docs: gh("argus-darkroom", "README.md", "age-check-optional"),
      },
    ],
    guides: [
      { label: "mivolo_v2 (model card)", url: "https://huggingface.co/iitolstykh/mivolo_v2" },
      { label: "MiVOLO on GitHub", url: "https://github.com/WildChlamydia/MiVOLO" },
    ],
  },
  {
    id: "insightface",
    title: "InsightFace",
    summary:
      "Face and person detection and identity embeddings. The `buffalo_l` pack downloads itself on first use, and there is no env var to set.",
    usedBy: [
      {
        pkg: "argus-curator",
        role: "Faces, identities and the boxes the age check uses.",
        config: ["[faces]", "[gpu]"],
        docs: gh("argus-curator", "README.md", "installation"),
      },
      {
        pkg: "argus-proof",
        role: "`IdentityScorer`: ArcFace similarity against held-out references (`--references`).",
        config: ["[score]", "--references"],
        docs: gh("argus-proof", "README.md", "scoring"),
      },
    ],
    guides: [{ label: "InsightFace on GitHub", url: "https://github.com/deepinsight/insightface" }],
  },
  {
    id: "places365-fashionpedia",
    title: "Places365 and Fashionpedia",
    summary: "Scene tags and garment detection for curator, each converted to ONNX by a curator command.",
    usedBy: [
      {
        pkg: "argus-curator",
        role: "Scene tags (`places365-convert --arch resnet18|resnet50`).",
        config: ["ARGUS_CURATOR_PLACES365_MODEL", "places365-convert", "[places365-convert]"],
        docs: gh("argus-curator", "docs/scene-tags.md", "installing-the-model"),
      },
      {
        pkg: "argus-curator",
        role: "Garments (`garments-convert`, from `valentinafevu/yolos-fashionpedia`).",
        config: ["ARGUS_CURATOR_GARMENTS_MODEL", "garments-convert", "[garments-convert]"],
        docs: gh("argus-curator", "docs/garments.md", "installing-the-model"),
      },
    ],
    guides: [
      { label: "Places365 on GitHub", url: "https://github.com/CSAILVision/places365" },
      { label: "yolos-fashionpedia (model card)", url: "https://huggingface.co/valentinafevu/yolos-fashionpedia" },
      { label: "Fashionpedia", url: "https://fashionpedia.github.io/home/" },
    ],
  },
  {
    id: "watermark-detector",
    title: "Watermark detector",
    summary: "A YOLO watermark model served as a sidecar with NudeNet's `/infer` API, for curator's crop and watermark checks.",
    usedBy: [
      {
        pkg: "argus-curator",
        role: "`crops.detect`: finds watermarks so they can be cropped out or the image dropped.",
        config: ["ARGUS_CURATOR_WATERMARK_URL", "ARGUS_CURATOR_WATERMARK_TIMEOUT", "ARGUS_CURATOR_WATERMARK_WORKERS"],
        docs: gh("argus-curator", "docs/crops.md", "finding-watermarks"),
      },
    ],
    guides: [
      {
        label: "joycaption-watermark-detection (YOLO11x)",
        url: "https://huggingface.co/spaces/fancyfeast/joycaption-watermark-detection",
      },
      { label: "watermarks_yolov8", url: "https://huggingface.co/mnemic/watermarks_yolov8", note: "a lighter alternative" },
    ],
  },
  {
    id: "model-downloads",
    title: "Model downloads (Hugging Face Hub)",
    summary:
      "Lens's local backends and curator's converters fetch weights from the Hugging Face Hub on first use and cache them under `HF_HOME`. Mount that cache into containers so the download happens only once.",
    usedBy: [
      {
        pkg: "argus-lens",
        role: "WD14 (`SmilingWolf/wd-vit-tagger-v3`), RAM++, Florence-2 (`florence-community/Florence-2-base`) and BLIP-2.",
        config: ["[local]", "[wd14]", "[torch]", "HF_HOME", "WD14_MODEL_REPO", "WD14_MODEL_DIR", "RAM_MODEL_DIR", "HF_TRUST_REMOTE_CODE"],
        docs: gh("argus-lens", "README.md", "model-caching"),
      },
      {
        pkg: "argus-curator",
        role: "The `*-convert` commands download and convert MiVOLO, Places365 and Fashionpedia.",
        config: ["mivolo-convert", "places365-convert", "garments-convert"],
        docs: gh("argus-curator", "docs/cli.md"),
      },
      {
        pkg: "argus-forge",
        role: "The training image downloads the base checkpoint. Mount the HF cache to keep it.",
        config: ["HF_HOME"],
        docs: gh("argus-forge", "README.md", "training-image--train"),
      },
    ],
    guides: [
      { label: "Download files from the Hub", url: "https://huggingface.co/docs/huggingface_hub/guides/download" },
      { label: "Manage the cache", url: "https://huggingface.co/docs/huggingface_hub/guides/manage-cache" },
      { label: "User access tokens", url: "https://huggingface.co/docs/hub/security-tokens", note: "for gated models" },
      { label: "WD14 tagger v3 (EVA02 large)", url: "https://huggingface.co/SmilingWolf/wd-eva02-large-tagger-v3" },
      { label: "Recognize Anything (RAM++)", url: "https://github.com/xinyu1205/recognize-anything" },
      { label: "RAM++ weights", url: "https://huggingface.co/xinyu1205/recognize-anything-plus-model" },
      { label: "Florence-2 base", url: "https://huggingface.co/microsoft/Florence-2-base" },
      { label: "BLIP-2 OPT 2.7b", url: "https://huggingface.co/Salesforce/blip2-opt-2.7b" },
    ],
  },
  {
    id: "checkpoints-loras",
    title: "Checkpoints and LoRAs",
    summary:
      "The ComfyUI `models/` tree (`checkpoints/`, `loras/`, …), mounted read-only into the services that list or pin models. Each model's licence comes from its own model card.",
    usedBy: [
      {
        pkg: "argus-darkroom",
        role: "Lists the checkpoints a request can name. Mount the folder ComfyUI actually lists, including any from `extra_model_paths`.",
        config: ["ARGUS_DARKROOM_MODELS_ROOT", "MODELS_ROOT", "ARGUS_DARKROOM_DEFAULT_CHECKPOINT"],
        docs: gh("argus-darkroom", "README.md", "configuration"),
      },
      {
        pkg: "argus-atlas",
        role: "`bake --checkpoint` (required, named as ComfyUI loads it) and `--lora` for the cartography LoRA. The models dir is used only for SHA256 pinning.",
        config: ["--checkpoint", "--lora", "ATLAS_MODELS_DIR", "--models-dir"],
        docs: gh("argus-atlas", "README.md", "three-ways-to-bake"),
      },
      {
        pkg: "argus-proof",
        role: "Lists `<dir>/checkpoints` and `<dir>/loras`. Several roots can be joined with `:`.",
        config: ["PROOF_MODELS_DIR"],
        docs: gh("argus-proof", "README.md", "generation-backend"),
      },
    ],
    guides: [
      {
        label: "ComfyUI manual install",
        url: "https://docs.comfy.org/installation/manual_install",
        note: "the model folder layout",
      },
    ],
  },
  {
    id: "trainers",
    title: "Trainers (kohya sd-scripts, OneTrainer)",
    summary:
      "Forge writes training configs for kohya sd-scripts, OneTrainer and diffusers, and can run kohya itself in its `-train` image.",
    usedBy: [
      {
        pkg: "argus-forge",
        role: "`kohya`: the forged `train.sh` runs from `SD_SCRIPTS_DIR` (preset to `/opt/sd-scripts` in the `-train` image).",
        config: ["SD_SCRIPTS_DIR", "argus-forge run --env"],
        docs: gh("argus-forge", "README.md", "training-image--train"),
      },
      {
        pkg: "argus-forge",
        role: "`onetrainer`: config files only, loaded in OneTrainer's own UI. `diffusers`: points at a training script.",
        config: ["DIFFUSERS_SCRIPT"],
        docs: gh("argus-forge", "README.md", "install"),
      },
    ],
    guides: [
      { label: "kohya-ss/sd-scripts", url: "https://github.com/kohya-ss/sd-scripts" },
      { label: "OneTrainer", url: "https://github.com/Nerogar/OneTrainer" },
    ],
  },
  {
    id: "gdal-pdal",
    title: "GDAL and PDAL",
    summary:
      "Geospatial libraries. Atlas needs GDAL for rasters and tiles. Survey needs PDAL, GDAL and PROJ for point clouds and surfaces. Both Docker images ship them, so you only install them for a native run.",
    usedBy: [
      {
        pkg: "argus-atlas",
        role: "GDAL (`gdal-bin`, incl. `gdal2tiles.py`). The image is built on the OSGeo GDAL image. Check with `argus-atlas doctor`.",
        config: ["[tiles]"],
        docs: gh("argus-atlas", "README.md", "install"),
      },
      {
        pkg: "argus-survey",
        role: "PDAL, GDAL and PROJ from conda-forge (a lockfile in `env/`). Datum grids come from `projsync`, and `PROJ_NETWORK` is forced off.",
        config: ["PROJ_NETWORK=OFF"],
        docs: gh("argus-survey", "README.md", "without-docker"),
      },
    ],
    guides: [
      { label: "GDAL download", url: "https://gdal.org/en/stable/download.html" },
      { label: "PDAL download", url: "https://pdal.io/en/stable/download.html" },
    ],
  },
  {
    id: "map-data",
    title: "Map data and tiles",
    summary:
      "Atlas pulls elevation, OSM layers and place names, and writes PMTiles. Realms shows the result over an OpenFreeMap basemap. Mind each source's usage policy, especially the public Overpass and OSM tile servers.",
    usedBy: [
      {
        pkg: "argus-atlas",
        role: "`dem`: Copernicus GLO-30 from AWS.",
        config: ["ATLAS_DEM_SOURCE", "--source"],
        docs: gh("argus-atlas", "README.md", "quick-start"),
      },
      {
        pkg: "argus-atlas",
        role: "`osm`: roads, water and the rest from Overpass (the server's `POST /osm` also needs `ATLAS_ALLOW_OSM=1`).",
        config: ["ATLAS_OVERPASS_URL", "--overpass-url", "ATLAS_ALLOW_OSM"],
        docs: gh("argus-atlas", "README.md", "osm-layers-and-the-composite"),
      },
      {
        pkg: "argus-atlas",
        role: "`labels` (a local Natural Earth or Geofabrik file) and `tiles` (PMTiles).",
        config: ["labels --source", "[tiles]"],
        docs: gh("argus-atlas", "README.md", "chunks-mosaics-and-place-names"),
      },
      {
        pkg: "Realms",
        role: "Shows atlas's prebaked mosaic over an OpenFreeMap basemap.",
        config: [],
      },
    ],
    guides: [
      { label: "Copernicus DEM on AWS", url: "https://registry.opendata.aws/copernicus-dem/" },
      { label: "Overpass API", url: "https://wiki.openstreetmap.org/wiki/Overpass_API" },
      { label: "Natural Earth downloads", url: "https://www.naturalearthdata.com/downloads/" },
      { label: "Geofabrik extracts", url: "https://download.geofabrik.de/" },
      { label: "PMTiles", url: "https://docs.protomaps.com/pmtiles/" },
      { label: "OpenFreeMap", url: "https://openfreemap.org/" },
      { label: "OSM tile usage policy", url: "https://operations.osmfoundation.org/policies/tiles/" },
    ],
  },
  {
    id: "ipfs-foundry-base",
    title: "IPFS (Kubo), Foundry and Base",
    summary:
      "Mint pins card media to IPFS, signs with a Foundry keystore, and publishes on Base. It defaults to the Base Sepolia testnet.",
    usedBy: [
      {
        pkg: "argus-mint",
        role: "Pinning through the Kubo RPC (compose runs Kubo on loopback `:5001`).",
        config: ["ARGUS_MINT_IPFS_API"],
        docs: gh("argus-mint", "README.md", "running-the-service"),
      },
      {
        pkg: "argus-mint",
        role: "Chain and signing: network, RPC and a Foundry keystore account.",
        config: [
          "ARGUS_MINT_NETWORK",
          "ARGUS_MINT_RPC_URL",
          "ARGUS_MINT_ACCOUNT",
          "ARGUS_MINT_KEYSTORE_DIR",
          "ARGUS_MINT_KEYSTORE_PASSWORD_FILE",
        ],
        docs: gh("argus-mint", "README.md", "deploy-base"),
      },
      {
        pkg: "argus-assay",
        role: "Through argus-mint. Its mock replaces all of this.",
        config: [],
        docs: gh("argus-assay", "README.md", "running-it"),
      },
    ],
    guides: [
      { label: "Install Kubo", url: "https://docs.ipfs.tech/install/command-line/" },
      { label: "Run Kubo in Docker", url: "https://docs.ipfs.tech/install/run-ipfs-inside-docker/" },
      { label: "Install Foundry", url: "https://www.getfoundry.sh/introduction/installation" },
      { label: "Connect to Base", url: "https://docs.base.org/get-started/connect-to-base" },
    ],
  },
  {
    id: "stores",
    title: "Postgres, Qdrant and MinIO/S3",
    summary:
      "Optional stores for cortex's `argus_cortex.store`. Each one is off unless its URL is set. Agent-composer's guard server also needs a Postgres and a Qdrant to start.",
    usedBy: [
      {
        pkg: "argus-cortex",
        role: "Records (Postgres), vectors (Qdrant) and blobs (S3-compatible).",
        config: ["CORTEX_PG_URL", "CORTEX_QDRANT_URL", "CORTEX_S3_ENDPOINT", "CORTEX_S3_BUCKET", "[postgres]", "[qdrant]", "[s3]"],
        docs: gh("argus-cortex", "README.md", "whats-here"),
      },
      {
        pkg: "argus-lens",
        role: "`--backend replay` reads recorded captions from Postgres, and `LENS_RECORD_LINEAGE=1` records them.",
        config: ["CORTEX_PG_URL", "LENS_RECORD_LINEAGE", "[replay]", "[lineage]"],
        docs: gh("argus-lens", "README.md", "replay-backend-recorded-captions-no-gpu"),
      },
      {
        pkg: "SingGuard guard server",
        role: "agent-composer's `rag-chat` refuses to start without both.",
        config: ["QDRANT_URL", "DATABASE_URL"],
      },
    ],
    guides: [
      { label: "PostgreSQL downloads", url: "https://www.postgresql.org/download/" },
      { label: "Postgres Docker image", url: "https://hub.docker.com/_/postgres" },
      { label: "Qdrant quickstart", url: "https://qdrant.tech/documentation/quickstart/" },
      { label: "MinIO in a container", url: "https://docs.min.io/aistor/installation/container/" },
    ],
  },
  {
    id: "immich",
    title: "Immich",
    summary: "An optional self-hosted photo library that lens can caption from and write captions back to.",
    usedBy: [
      {
        pkg: "argus-lens",
        role: "`/immich/*`, `ImmichSource` and `ImmichSink`. With no URL, `/immich/*` answers 503.",
        config: ["IMMICH_URL", "IMMICH_API_KEY"],
        docs: gh("argus-lens", "README.md", "immich"),
      },
    ],
    guides: [
      { label: "Install Immich with Docker Compose", url: "https://docs.immich.app/install/docker-compose/" },
      { label: "Immich CLI", url: "https://docs.immich.app/features/command-line-interface/" },
    ],
  },
  {
    id: "image-sources",
    title: "Image sources",
    summary:
      "Where quarry acquires public-domain and CC0 images: Wikimedia Commons, plus the PD12M and Megalith metadata on Hugging Face for the `/gallery` Sources view.",
    usedBy: [
      {
        pkg: "argus-quarry",
        role: "`--source commons` (the default). Wikimedia asks for a contact User-Agent.",
        config: ["--source commons", "COMMONS_USER_AGENT", "QUARRY_USER_AGENT"],
        docs: gh("argus-quarry", "README.md", "sources"),
      },
      {
        pkg: "argus-quarry",
        role: "PD12M and Megalith metadata, plus optional CLIP text search.",
        config: ["QUARRY_PD12M_DIR", "QUARRY_MEGALITH_DIR", "QUARRY_ALLOW_FETCH", "HF_TOKEN", "[search]", "QUARRY_CLIP_MODEL"],
        docs: gh("argus-quarry", "README.md", "public-domain-archives"),
      },
    ],
    guides: [
      { label: "Commons API", url: "https://commons.wikimedia.org/wiki/Commons:API" },
      { label: "PD12M dataset", url: "https://huggingface.co/datasets/Spawning/PD12M" },
      { label: "Megalith-10m dataset", url: "https://huggingface.co/datasets/madebyollin/megalith-10m" },
    ],
  },
];

export function getService(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

export function serviceHref(id: string): string {
  return `/docs/setup/services/${id}`;
}
