/**
 * Runtime configuration for the published image.
 *
 * `NEXT_PUBLIC_*` values are inlined into the client bundle at build time, so a
 * published `ghcr.io/smk762/argus-studio` image carries whatever URLs were baked
 * during `npm run build` — a deployment's `environment:` block is inert. That
 * makes one image undeployable to a second origin (see argus-studio#56).
 *
 * Instead the config is resolved **per request**:
 *
 *   - On the server, {@link resolveRuntimeConfig} reads `process.env` through a
 *     computed key, so Next's build-time inliner leaves it alone and the value
 *     comes from the container's real environment.
 *   - The root layout serializes the result into `window.__ARGUS_ENV__` before
 *     hydration, and the client reads it back from there.
 *
 * Both sides therefore see the same values for a given request, so nothing
 * rendered from config can produce a hydration mismatch — provided the injected
 * script actually ran. If it did not, {@link runtimeConfig} says so loudly
 * rather than silently substituting dev defaults.
 *
 * Precedence per field: `ARGUS_*` (runtime) → `NEXT_PUBLIC_*` (build-time,
 * kept for backwards compatibility with existing compose files) → default.
 *
 * The API bases are `ARGUS_<SERVICE>_BROWSER_URL`, not `ARGUS_<SERVICE>_URL`:
 * the short name is the suite-wide server-to-server URL (argus-cortex `peers`),
 * and a browser path under it would stop a service that reads it as a peer.
 *
 * An explicitly **empty** URL means "same origin": the API clients build
 * relative URLs (`/scan/folder`). Only an *unset* variable falls back to the
 * `http://localhost:810x` dev defaults. A **path prefix** (`/api/curator`) works
 * the same way and is what you want when more than one service sits behind a
 * single origin — the six backends share `/health`, `/folders` and `/thumb`, so
 * at most one of them can be mounted at the origin root. Empty is meaningful
 * only for URLs; for the mode and path settings an empty value is treated as
 * unset, so it cannot silently shadow a legacy `NEXT_PUBLIC_*` name.
 */

import { STATIC_DEMO } from "@/lib/staticDemo";

/** Resolved endpoints + mode the browser needs to talk to the suite. */
export interface RuntimeConfig {
  /** Browser-facing argus-lens API base (captioning). */
  lensUrl: string;
  /** Browser-facing argus-curator API base. */
  curatorUrl: string;
  /** Browser-facing argus-quarry API base (provenance gallery). */
  quarryUrl: string;
  /** Browser-facing argus-forge API base (training-config bridge). */
  forgeUrl: string;
  /** Browser-facing argus-proof API base (post-training eval). */
  proofUrl: string;
  /** Browser-facing argus-atlas API base (georeferenced map bakes). */
  atlasUrl: string;
  /** Browser-facing argus-darkroom API base (guarded generation). */
  darkroomUrl: string;
  /** Link to the standalone argus-lightbox UI, or empty for no link. */
  lightboxUrl: string;
  /** Link to the standalone argus-cull UI, or empty for no link. */
  cullUrl: string;
  /** Link to the standalone argus-safelight UI, or empty for no link. */
  safelightUrl: string;
  /** Link to argus-sightline (the argus-survey workspace), or empty for no link. */
  sightlineUrl: string;
  /** Link to argus-mask's viewer (the talking face), or empty for no link. */
  maskUrl: string;
  /** Link to argus-assay, argus-mint's review UI, or empty for no link. */
  assayUrl: string;
  /** Link to argus-puppet's demo UI (body pose), or empty for no link. */
  puppetUiUrl: string;
  /** `demo` = bundled read-only sample, `live` = real backends. */
  curatorUiMode: CuratorUiMode;
  /**
   * Whether /forge talks to argus-forge (`live`) or renders the bundled demo.
   * `ARGUS_FORGE_UI_MODE`, defaulting to {@link curatorUiMode}: a public demo
   * can keep curator on its sample while forge renders real exports (#59).
   */
  forgeUiMode: CuratorUiMode;
  /** The same for /proof (`ARGUS_PROOF_UI_MODE`): a replay-mode proof serves stored reports. */
  proofUiMode: CuratorUiMode;
  /** Scan input directory as seen by argus-curator (container path under Docker). */
  curatorSourcePath: string;
  /** Export target directory on the curator host. */
  curatorOutputPath: string;
  /** Offer what's held back from normal use, such as SingGuard policies under evaluation. */
  devMode: boolean;
}

export type CuratorUiMode = "demo" | "live";

/** The global the root layout writes and the client reads back. */
export const RUNTIME_CONFIG_GLOBAL = "__ARGUS_ENV__";

declare global {
  var __ARGUS_ENV__: RuntimeConfig | undefined;
}

/**
 * First defined value among `names`, in order. Distinguishes unset (`undefined`,
 * keep looking) from explicitly empty (`""`, a deliberate same-origin choice),
 * so this is the lookup for URL settings only — see {@link firstNonEmpty}.
 *
 * `source` is indexed with a *variable*, never a literal `process.env.FOO` member
 * expression. That matters: Next's build-time inliner only rewrites the literal
 * form, so keeping the lookup computed is what stops the value being baked into
 * the client bundle (argus-studio#56). Do not "simplify" this to a literal.
 */
function firstDefined(
  source: Record<string, string | undefined>,
  names: readonly string[],
): string | undefined {
  for (const name of names) {
    const value = source[name];
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * Like {@link firstDefined}, but skips values that are empty once trimmed. For
 * the mode and path settings an empty string carries no meaning, so treating it
 * as "set" would let `ARGUS_CURATOR_UI_MODE=` shadow a working legacy
 * `NEXT_PUBLIC_CURATOR_UI_MODE=live` and silently drop the app into demo mode.
 */
function firstNonEmpty(
  source: Record<string, string | undefined>,
  names: readonly string[],
): string | undefined {
  for (const name of names) {
    const value = source[name];
    if (value !== undefined && value.trim() !== "") return value.trim();
  }
  return undefined;
}

/**
 * An http(s) URL. Parseability alone is not enough: `new URL("curator:8101")`
 * succeeds with `curator:` as the scheme, which is exactly the scheme-less
 * mistake {@link normalizeBase} exists to catch.
 */
function isAbsoluteUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Normalize an API base: trim, drop any trailing slashes so callers can always
 * write `${base}/health`. An empty base stays empty, yielding a relative
 * (same-origin) request path; so does a bare `/`, which is the same thing.
 *
 * Warns about a value that is neither empty, nor an origin-relative path prefix,
 * nor a parseable absolute URL — a scheme-less `curator:8101` would otherwise
 * sail through and surface only as an opaque `TypeError: Failed to fetch` in
 * someone's browser. In the container this lands in `docker logs frontend`.
 */
function normalizeBase(value: string, name = "API base"): string {
  const base = value.trim().replace(/\/+$/, "");
  if (base !== "" && !base.startsWith("/") && !isAbsoluteUrl(base)) {
    console.warn(
      `[argus] ${name}="${base}" is not a valid absolute URL or "/"-prefixed path; ` +
        `requests to it will fail. Set it to a full URL, a path prefix, or empty for same-origin.`,
    );
  }
  return base;
}

/**
 * The pre-rename name of a browser-side URL (`ARGUS_LENS_URL` for
 * `ARGUS_LENS_BROWSER_URL`), honoured only when its value is a path. That name is
 * now the suite-wide *server* URL of the service (argus-cortex `peers`,
 * smk762/argus-cortex#209), so an absolute URL under it is another service's
 * setting and an empty one says nothing: both are ignored here.
 */
function deprecatedPath(
  source: Record<string, string | undefined>,
  oldName: string,
  newName: string,
): string | undefined {
  const value = source[oldName]?.trim();
  if (!value?.startsWith("/")) return undefined;
  console.warn(`[argus] ${oldName} is deprecated as a browser path; set ${newName} instead.`);
  return value;
}

/**
 * Resolve one API base: its runtime name, then the pre-rename name when that
 * holds a path, then the legacy build-time name, then the dev default.
 */
function resolveBase(
  source: Record<string, string | undefined>,
  name: string,
  oldName: string,
  legacy: readonly string[],
  fallback: string,
): string {
  const value =
    firstDefined(source, [name]) ?? deprecatedPath(source, oldName, name) ?? firstDefined(source, legacy) ?? fallback;
  return normalizeBase(value, name);
}

/**
 * A link to another app, not an API base: empty means no link rather than same
 * origin, and it ends up in an `href`, so anything but http(s) or a path is
 * dropped instead of only warned about. `oldName` is a pre-rename name, read
 * as {@link deprecatedPath} reads it.
 */
function resolveLink(source: Record<string, string | undefined>, name: string, oldName?: string): string {
  const value = firstNonEmpty(source, [name]) ?? (oldName ? deprecatedPath(source, oldName, name) : undefined);
  if (value === undefined) return "";
  if (value.startsWith("/") || isAbsoluteUrl(value)) return value.replace(/\/+$/, "");
  console.warn(`[argus] ${name}="${value}" is not a valid absolute URL or "/"-prefixed path; omitting the link.`);
  return "";
}

/** `local` is accepted as a legacy alias for `live`. */
function resolveUiMode(raw: string | undefined, name = "ARGUS_CURATOR_UI_MODE"): CuratorUiMode {
  const mode = (raw ?? "demo").toLowerCase();
  if (mode !== "live" && mode !== "local" && mode !== "demo") {
    console.warn(`[argus] ${name}="${raw}" is not recognised; falling back to demo.`);
  }
  return mode === "live" || mode === "local" ? "live" : "demo";
}

/** A stage's own UI mode when `name` is set, else the curator mode it has always followed. */
function resolveStageMode(
  source: Record<string, string | undefined>,
  name: string,
  curator: CuratorUiMode,
): CuratorUiMode {
  const raw = firstNonEmpty(source, [name]);
  return raw === undefined ? curator : resolveUiMode(raw, name);
}

/** `1`, `true`, `yes` or `on`, in any case. Anything else is off. */
function resolveFlag(raw: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((raw ?? "").toLowerCase());
}

/**
 * Build a {@link RuntimeConfig} from an environment mapping. Pure, so the
 * precedence rules are testable without a running server.
 */
export function resolveRuntimeConfig(
  source: Record<string, string | undefined>,
): RuntimeConfig {
  const curatorUiMode = resolveUiMode(
    firstNonEmpty(source, ["ARGUS_CURATOR_UI_MODE", "NEXT_PUBLIC_CURATOR_UI_MODE"]),
  );
  return {
    lensUrl: resolveBase(source, "ARGUS_LENS_BROWSER_URL", "ARGUS_LENS_URL", ["NEXT_PUBLIC_API_URL"], "http://localhost:8100"),
    curatorUrl: resolveBase(source, "ARGUS_CURATOR_BROWSER_URL", "ARGUS_CURATOR_URL", ["NEXT_PUBLIC_CURATOR_URL"], "http://localhost:8101"),
    quarryUrl: resolveBase(source, "ARGUS_QUARRY_BROWSER_URL", "ARGUS_QUARRY_URL", ["NEXT_PUBLIC_QUARRY_URL"], "http://localhost:8102"),
    forgeUrl: resolveBase(source, "ARGUS_FORGE_BROWSER_URL", "ARGUS_FORGE_URL", ["NEXT_PUBLIC_FORGE_URL"], "http://localhost:8103"),
    proofUrl: resolveBase(source, "ARGUS_PROOF_BROWSER_URL", "ARGUS_PROOF_URL", ["NEXT_PUBLIC_PROOF_URL"], "http://localhost:8104"),
    atlasUrl: resolveBase(source, "ARGUS_ATLAS_BROWSER_URL", "ARGUS_ATLAS_URL", ["NEXT_PUBLIC_ATLAS_URL"], "http://localhost:8105"),
    darkroomUrl: resolveBase(source, "ARGUS_DARKROOM_BROWSER_URL", "ARGUS_DARKROOM_URL", [], "http://localhost:8106"),
    lightboxUrl: resolveLink(source, "ARGUS_LIGHTBOX_URL"),
    cullUrl: resolveLink(source, "ARGUS_CULL_URL"),
    safelightUrl: resolveLink(source, "ARGUS_SAFELIGHT_URL"),
    sightlineUrl: resolveLink(source, "ARGUS_SIGHTLINE_URL"),
    maskUrl: resolveLink(source, "ARGUS_MASK_UI_URL", "ARGUS_MASK_URL"),
    assayUrl: resolveLink(source, "ARGUS_ASSAY_URL"),
    puppetUiUrl: resolveLink(source, "ARGUS_PUPPET_UI_URL"),
    curatorUiMode,
    forgeUiMode: resolveStageMode(source, "ARGUS_FORGE_UI_MODE", curatorUiMode),
    proofUiMode: resolveStageMode(source, "ARGUS_PROOF_UI_MODE", curatorUiMode),
    curatorSourcePath:
      firstNonEmpty(source, ["ARGUS_CURATOR_SOURCE_PATH", "NEXT_PUBLIC_CURATOR_SOURCE_PATH"]) ?? "",
    curatorOutputPath:
      firstNonEmpty(source, ["ARGUS_CURATOR_OUTPUT_PATH", "NEXT_PUBLIC_CURATOR_OUTPUT_PATH"]) ?? "",
    devMode: resolveFlag(firstNonEmpty(source, ["ARGUS_DEVMODE", "DEVMODE"])),
  };
}

/**
 * The fixed config of the static demo export (see lib/staticDemo.ts). There is
 * no server to resolve an environment per request and no backend to point at:
 * every page reads bundled recorded output instead, so the URLs are empty and
 * the mode is always `demo`.
 */
const STATIC_DEMO_CONFIG: RuntimeConfig = {
  lensUrl: "",
  curatorUrl: "",
  quarryUrl: "",
  forgeUrl: "",
  proofUrl: "",
  atlasUrl: "",
  darkroomUrl: "",
  lightboxUrl: "",
  cullUrl: "",
  safelightUrl: "",
  sightlineUrl: "",
  maskUrl: "",
  assayUrl: "",
  puppetUiUrl: "",
  curatorUiMode: "demo",
  forgeUiMode: "demo",
  proofUiMode: "demo",
  curatorSourcePath: "/data/images",
  curatorOutputPath: "/data/out",
  devMode: false,
};

/** Memoized server-side resolve: a container's `process.env` cannot change under it. */
let serverConfig: RuntimeConfig | undefined;
/** So a missing injected global is reported once, not once per component render. */
let warnedMissingGlobal = false;

/**
 * The active config for this request.
 *
 * Server: resolved once from `process.env`. Client: read back from the global
 * the layout injected.
 *
 * If that global is missing the client is in a broken state — the most likely
 * cause is a `script-src` CSP that blocked the layout's inline script: one whose
 * nonce it doesn't carry, e.g. a policy set or rewritten by a reverse proxy.
 * Returning dev defaults there would silently repaint a live deployment as the
 * bundled demo pointed at the *visitor's* localhost, so this complains loudly
 * first. It still returns the defaults so the page renders something rather
 * than blanking out on an exception during hydration.
 */
export function runtimeConfig(): RuntimeConfig {
  if (STATIC_DEMO) return STATIC_DEMO_CONFIG;
  if (typeof window === "undefined") {
    serverConfig ??= resolveRuntimeConfig(process.env as Record<string, string | undefined>);
    return serverConfig;
  }
  const injected = globalThis.__ARGUS_ENV__;
  if (injected) return injected;
  if (!warnedMissingGlobal) {
    warnedMissingGlobal = true;
    console.error(
      `[argus] window.${RUNTIME_CONFIG_GLOBAL} is missing — the root layout's config script did not run ` +
        `(a Content-Security-Policy whose nonce it doesn't carry is the usual cause; see ARGUS_CSP). ` +
        `Falling back to localhost dev defaults and demo mode; API calls will target this browser's own machine.`,
    );
  }
  return resolveRuntimeConfig({});
}

/**
 * The `<script>` body the root layout inlines ahead of hydration. Serialized
 * with `JSON.stringify` and `<` escaped so a value can never close the tag.
 */
export function runtimeConfigScript(config: RuntimeConfig): string {
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `window.${RUNTIME_CONFIG_GLOBAL}=${json};`;
}
