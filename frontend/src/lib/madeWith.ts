/**
 * The "Made with" line on each tool page (#171): which suite package produced
 * the view, at which version, by what command, with links to its handbook page,
 * PyPI and GitHub. Versions and command arguments come from the data the page
 * shows (a /health answer, a recording, the result itself), never a constant.
 */

import { handbookUrl } from "@/lib/handbook";

export const MADE_WITH_PACKAGES = ["lens", "curator", "quarry", "forge", "proof", "atlas", "darkroom"] as const;
export type SuitePackage = (typeof MADE_WITH_PACKAGES)[number];

export interface PackageLinks {
  /** The distribution name, e.g. `argus-lens`. */
  name: string;
  docs: string;
  pypi: string;
  github: string;
}

export function packageLinks(pkg: SuitePackage): PackageLinks {
  const name = `argus-${pkg}`;
  return {
    name,
    docs: handbookUrl(`packages/${pkg}/`),
    pypi: `https://pypi.org/project/${name}/`,
    github: `https://github.com/smk762/${name}`,
  };
}

/**
 * A version worth printing: a release or dev version string, with any leading
 * `v` dropped. Page sentinels (null while loading, "" when unreachable,
 * "demo"/"sample"/"recorded") give null, so the line names the package alone.
 */
export function shownVersion(version: string | null | undefined): string | null {
  const v = (version ?? "").trim().replace(/^v(?=\d)/, "");
  return /^\d+(\.\d+)*/.test(v) ? v : null;
}

/** `argus-lens caption` with the settings a result was made with. Defaults are left out. */
export function lensCaptionCommand(opts: {
  backend?: string | null;
  style?: string | null;
  category?: string | null;
  targetBackend?: string | null;
}): string {
  const parts = ["argus-lens caption <images>"];
  if (opts.backend) parts.push(`--backend ${opts.backend}`);
  if (opts.style && opts.style !== "photo") parts.push(`--style ${opts.style}`);
  if (opts.category && opts.category !== "identity") parts.push(`--category ${opts.category}`);
  if (opts.targetBackend && opts.targetBackend !== "sdxl") parts.push(`--target-backend ${opts.targetBackend}`);
  return parts.join(" ");
}

export function curatorScanCommand(category?: string | null): string {
  return category && category !== "identity"
    ? `argus-curator scan <folder> --target-category ${category}`
    : "argus-curator scan <folder>";
}

export function forgeConfigCommand(trainer?: string | null): string {
  return `argus-forge config <export> --trainer ${trainer || "kohya"}`;
}

export function darkroomGenerateCommand(policy?: string | null): string {
  return policy ? `argus-darkroom generate --policy ${policy}` : "argus-darkroom generate";
}
