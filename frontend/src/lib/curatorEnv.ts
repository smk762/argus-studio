/**
 * Curator SPA mode + path defaults, baked in at build time (NEXT_PUBLIC_*).
 *
 *   demo (default) — read-only bundled sample scan; no backend required. Ideal
 *                    for the public GitHub demo.
 *   live           — real scans/exports against NEXT_PUBLIC_CURATOR_URL using
 *                    folder paths on the curator host (e.g. Docker volumes).
 *
 * `local` is accepted as a legacy alias for `live`.
 */
export type CuratorUiMode = "demo" | "live";

const raw = (process.env.NEXT_PUBLIC_CURATOR_UI_MODE ?? "demo").toLowerCase();

export const CURATOR_UI_MODE: CuratorUiMode =
  raw === "live" || raw === "local" ? "live" : "demo";

export const IS_LIVE = CURATOR_UI_MODE === "live";

/** URL the browser uses to reach the argus-curator API. */
export const CURATOR_URL =
  process.env.NEXT_PUBLIC_CURATOR_URL ?? "http://localhost:8101";

/** URL the browser uses to reach the argus-lens API. */
export const LENS_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

/**
 * URL the **curator container** uses to reach argus-lens for the export→caption
 * handoff. This is a server-to-server call made by argus-curator, so in Docker it
 * is the compose service name (e.g. http://argus-lens:8100), not the browser's
 * localhost. Falls back to {@link LENS_URL} for host/local dev.
 */
export const LENS_INTERNAL_URL =
  process.env.NEXT_PUBLIC_LENS_INTERNAL_URL ?? LENS_URL;

/** URL the browser uses to reach the argus-forge API (training-config bridge). */
export const FORGE_URL = process.env.NEXT_PUBLIC_FORGE_URL ?? "http://localhost:8103";

/** Scan input directory as seen by argus-curator (container path under Docker). */
export const LOCAL_SOURCE_PATH = process.env.NEXT_PUBLIC_CURATOR_SOURCE_PATH ?? "";

/** Export target directory on the curator host. */
export const LOCAL_OUTPUT_PATH = process.env.NEXT_PUBLIC_CURATOR_OUTPUT_PATH ?? "";
