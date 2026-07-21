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
 * An explicitly **empty** URL means "same origin": the API clients build
 * relative URLs (`/scan/folder`). Only an *unset* variable falls back to the
 * `http://localhost:810x` dev defaults. A **path prefix** (`/api/curator`) works
 * the same way and is what you want when more than one service sits behind a
 * single origin — the five backends share `/health`, `/folders` and `/thumb`, so
 * at most one of them can be mounted at the origin root. Empty is meaningful
 * only for URLs; for the mode and path settings an empty value is treated as
 * unset, so it cannot silently shadow a legacy `NEXT_PUBLIC_*` name.
 */

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
  /** `demo` = bundled read-only sample, `live` = real backends. */
  curatorUiMode: CuratorUiMode;
  /** Scan input directory as seen by argus-curator (container path under Docker). */
  curatorSourcePath: string;
  /** Export target directory on the curator host. */
  curatorOutputPath: string;
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

function isAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
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

/** Resolve one API base from its runtime name, legacy build-time name, and dev default. */
function resolveBase(
  source: Record<string, string | undefined>,
  names: readonly string[],
  fallback: string,
): string {
  return normalizeBase(firstDefined(source, names) ?? fallback, names[0]);
}

/** `local` is accepted as a legacy alias for `live`. */
function resolveUiMode(raw: string | undefined): CuratorUiMode {
  const mode = (raw ?? "demo").toLowerCase();
  if (mode !== "live" && mode !== "local" && mode !== "demo") {
    console.warn(`[argus] ARGUS_CURATOR_UI_MODE="${raw}" is not recognised; falling back to demo.`);
  }
  return mode === "live" || mode === "local" ? "live" : "demo";
}

/**
 * Build a {@link RuntimeConfig} from an environment mapping. Pure, so the
 * precedence rules are testable without a running server.
 */
export function resolveRuntimeConfig(
  source: Record<string, string | undefined>,
): RuntimeConfig {
  return {
    lensUrl: resolveBase(source, ["ARGUS_LENS_URL", "NEXT_PUBLIC_API_URL"], "http://localhost:8100"),
    curatorUrl: resolveBase(source, ["ARGUS_CURATOR_URL", "NEXT_PUBLIC_CURATOR_URL"], "http://localhost:8101"),
    quarryUrl: resolveBase(source, ["ARGUS_QUARRY_URL", "NEXT_PUBLIC_QUARRY_URL"], "http://localhost:8102"),
    forgeUrl: resolveBase(source, ["ARGUS_FORGE_URL", "NEXT_PUBLIC_FORGE_URL"], "http://localhost:8103"),
    proofUrl: resolveBase(source, ["ARGUS_PROOF_URL", "NEXT_PUBLIC_PROOF_URL"], "http://localhost:8104"),
    curatorUiMode: resolveUiMode(
      firstNonEmpty(source, ["ARGUS_CURATOR_UI_MODE", "NEXT_PUBLIC_CURATOR_UI_MODE"]),
    ),
    curatorSourcePath:
      firstNonEmpty(source, ["ARGUS_CURATOR_SOURCE_PATH", "NEXT_PUBLIC_CURATOR_SOURCE_PATH"]) ?? "",
    curatorOutputPath:
      firstNonEmpty(source, ["ARGUS_CURATOR_OUTPUT_PATH", "NEXT_PUBLIC_CURATOR_OUTPUT_PATH"]) ?? "",
  };
}

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
 * cause is a `script-src` CSP that blocked the layout's un-nonced inline script.
 * Returning dev defaults there would silently repaint a live deployment as the
 * bundled demo pointed at the *visitor's* localhost, so this complains loudly
 * first. It still returns the defaults so the page renders something rather
 * than blanking out on an exception during hydration.
 */
export function runtimeConfig(): RuntimeConfig {
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
        `(a Content-Security-Policy blocking inline scripts is the usual cause). ` +
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
