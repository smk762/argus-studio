/** The standalone demo UIs, each a client for one suite service. A URL that isn't configured leaves its link out. */

export interface SuiteLink {
  label: string;
  /** The service the UI is a demo of. */
  service: string;
  href: string;
}

export function suiteLinks(urls: { lightbox: string; cull: string; safelight: string; sightline?: string }): SuiteLink[] {
  const all = [
    { label: "Lightbox", service: "argus-lens", href: urls.lightbox },
    { label: "Cull", service: "argus-curator", href: urls.cull },
    { label: "Safelight", service: "argus-darkroom", href: urls.safelight },
    { label: "Sightline", service: "argus-survey", href: urls.sightline ?? "" },
  ];
  return all.filter((link) => link.href !== "");
}
