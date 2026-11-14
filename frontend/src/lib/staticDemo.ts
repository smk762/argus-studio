/**
 * Static, backend-free demo build (`NEXT_PUBLIC_DEMO_STATIC=1 npm run build:static`).
 *
 * This flag is deliberately a *literal* `process.env.NEXT_PUBLIC_*` read: unlike
 * the per-request endpoint config in runtimeConfig.ts (argus-studio#56), it
 * selects a different *build* — `output: "export"`, no server, no backends — so
 * it is meant to be inlined at build time. It never reaches the published
 * container image, which is built without it and behaves exactly as before.
 *
 * In the static build every page renders from bundled, recorded output instead
 * of calling an API, and says so with {@link RecordedDemoNote}.
 */
export const STATIC_DEMO = process.env.NEXT_PUBLIC_DEMO_STATIC === "1";

/** Public origin of the static demo, for canonical/OG URLs. */
export const DEMO_SITE_URL = "https://studio.dragonhound.dev";
/** Where "run it yourself" points. */
export const REPO_URL = "https://github.com/smk762/argus-studio";
/** The owner's site, linked from the demo banner. */
export const HOME_URL = "https://dragonhound.dev";

/**
 * Path to a file bundled under `public/demo/`. Relative to the site root, so it
 * works from any route of the export.
 */
export function demoAsset(path: string): string {
  return `/demo/${path.replace(/^\/+/, "")}`;
}
