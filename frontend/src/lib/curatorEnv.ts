/**
 * Named accessors over the per-request {@link runtimeConfig}.
 *
 * These are **functions**, not consts, because the config is resolved at
 * request time rather than baked into the bundle (see lib/runtimeConfig.ts and
 * argus-studio#56). A module-scope const would capture whatever was known when
 * the module first evaluated, which on the client is before the layout has
 * injected the real values.
 *
 * Curator SPA modes:
 *   demo (default) — read-only bundled sample scan; no backend required. Ideal
 *                    for the public GitHub demo.
 *   live           — real scans/exports against the curator URL using folder
 *                    paths on the curator host (e.g. Docker volumes).
 */

import { runtimeConfig, type CuratorUiMode } from "@/lib/runtimeConfig";

export type { CuratorUiMode };

/** Which curator SPA mode this deployment runs in. */
export function curatorUiMode(): CuratorUiMode {
  return runtimeConfig().curatorUiMode;
}

/** True when the curator SPA should talk to real backends instead of the sample. */
export function isLive(): boolean {
  return curatorUiMode() === "live";
}

/** URL the browser uses to reach the argus-curator API. */
export function curatorUrl(): string {
  return runtimeConfig().curatorUrl;
}

/** URL the browser uses to reach the argus-lens API. */
export function lensUrl(): string {
  return runtimeConfig().lensUrl;
}

/** URL the browser uses to reach the argus-quarry API (provenance gallery). */
export function quarryUrl(): string {
  return runtimeConfig().quarryUrl;
}

/** URL the browser uses to reach the argus-forge API (training-config bridge). */
export function forgeUrl(): string {
  return runtimeConfig().forgeUrl;
}

/** URL the browser uses to reach the argus-proof API (post-training eval). */
export function proofUrl(): string {
  return runtimeConfig().proofUrl;
}

/** Scan input directory as seen by argus-curator (container path under Docker). */
export function localSourcePath(): string {
  return runtimeConfig().curatorSourcePath;
}

/** Export target directory on the curator host. */
export function localOutputPath(): string {
  return runtimeConfig().curatorOutputPath;
}
