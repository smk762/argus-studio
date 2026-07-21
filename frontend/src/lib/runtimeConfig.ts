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
 * rendered from config can produce a hydration mismatch.
 *
 * Precedence per field: `ARGUS_*` (runtime) → `NEXT_PUBLIC_*` (build-time,
 * kept for backwards compatibility with existing compose files) → default.
 *
 * An explicitly **empty** value means "same origin": the API clients build
 * relative URLs (`/scan/folder`), which is what the argus-halo demo wants with
 * every service behind one Caddy origin. Only an *unset* variable falls back to
 * the `http://localhost:810x` dev defaults.
 */

/** Resolved endpoints + mode the browser needs to talk to the suite. */
export interface RuntimeConfig {
  /** Browser-facing argus-lens API base (captioning). */
  lensUrl: string;
  /** argus-lens base as seen by the **curator container** for the export→caption handoff. */
  lensInternalUrl: string;
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
 * Read `name` from the environment without tripping Next's build-time inliner.
 *
 * The inliner only rewrites *literal* `process.env.NEXT_PUBLIC_FOO` member
 * expressions, so indexing with a variable keeps the lookup dynamic — on the
 * server that reads the container's real environment at request time. In the
 * browser `process.env` is an empty object, which is fine: the client never
 * calls this path (it reads {@link RUNTIME_CONFIG_GLOBAL} instead).
 */
function readEnv(source: Record<string, string | undefined>, name: string): string | undefined {
  return source[name];
}

/**
 * First defined value among `names`, in order. Distinguishes unset (`undefined`,
 * keep looking) from explicitly empty (`""`, a deliberate same-origin choice).
 */
function firstDefined(
  source: Record<string, string | undefined>,
  names: readonly string[],
): string | undefined {
  for (const name of names) {
    const value = readEnv(source, name);
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * Normalize an API base: trim, drop any trailing slashes so callers can always
 * write `${base}/health`. An empty base stays empty, yielding a relative
 * (same-origin) request path.
 */
function normalizeBase(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/** Resolve one API base from its runtime name, legacy build-time name, and dev default. */
function resolveBase(
  source: Record<string, string | undefined>,
  names: readonly string[],
  fallback: string,
): string {
  return normalizeBase(firstDefined(source, names) ?? fallback);
}

/** `local` is accepted as a legacy alias for `live`. */
function resolveUiMode(raw: string | undefined): CuratorUiMode {
  const mode = (raw ?? "demo").trim().toLowerCase();
  return mode === "live" || mode === "local" ? "live" : "demo";
}

/**
 * Build a {@link RuntimeConfig} from an environment mapping. Pure, so the
 * precedence rules are testable without a running server.
 */
export function resolveRuntimeConfig(
  source: Record<string, string | undefined>,
): RuntimeConfig {
  const lensUrl = resolveBase(source, ["ARGUS_LENS_URL", "NEXT_PUBLIC_API_URL"], "http://localhost:8100");
  return {
    lensUrl,
    // Defaults to the browser-facing URL for host/local dev, where the curator
    // and the browser reach lens the same way.
    lensInternalUrl: resolveBase(
      source,
      ["ARGUS_LENS_INTERNAL_URL", "NEXT_PUBLIC_LENS_INTERNAL_URL"],
      lensUrl,
    ),
    curatorUrl: resolveBase(source, ["ARGUS_CURATOR_URL", "NEXT_PUBLIC_CURATOR_URL"], "http://localhost:8101"),
    quarryUrl: resolveBase(source, ["ARGUS_QUARRY_URL", "NEXT_PUBLIC_QUARRY_URL"], "http://localhost:8102"),
    forgeUrl: resolveBase(source, ["ARGUS_FORGE_URL", "NEXT_PUBLIC_FORGE_URL"], "http://localhost:8103"),
    proofUrl: resolveBase(source, ["ARGUS_PROOF_URL", "NEXT_PUBLIC_PROOF_URL"], "http://localhost:8104"),
    curatorUiMode: resolveUiMode(
      firstDefined(source, ["ARGUS_CURATOR_UI_MODE", "NEXT_PUBLIC_CURATOR_UI_MODE"]),
    ),
    curatorSourcePath:
      firstDefined(source, ["ARGUS_CURATOR_SOURCE_PATH", "NEXT_PUBLIC_CURATOR_SOURCE_PATH"]) ?? "",
    curatorOutputPath:
      firstDefined(source, ["ARGUS_CURATOR_OUTPUT_PATH", "NEXT_PUBLIC_CURATOR_OUTPUT_PATH"]) ?? "",
  };
}

/**
 * The active config for this request.
 *
 * Server: resolved fresh from `process.env`. Client: read back from the global
 * the layout injected, falling back to a bare resolve so unit tests and any
 * pre-injection import still get sane dev defaults.
 */
export function runtimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") {
    return resolveRuntimeConfig(process.env as Record<string, string | undefined>);
  }
  return globalThis.__ARGUS_ENV__ ?? resolveRuntimeConfig({});
}

/**
 * The `<script>` body the root layout inlines ahead of hydration. Serialized
 * with `JSON.stringify` and `<` escaped so a value can never close the tag.
 */
export function runtimeConfigScript(config: RuntimeConfig): string {
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `window.${RUNTIME_CONFIG_GLOBAL}=${json};`;
}
