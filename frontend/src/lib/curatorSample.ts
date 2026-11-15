/**
 * The bundled /curate demo sample: a recorded argus-curator scan
 * (public/curator-sample/scan.json) and the curator's own thumbnails for it,
 * written by scripts/record_curator_demo.py.
 */
import { CURATOR_SAMPLE_THUMBS } from "@/lib/curatorSampleThumbs";

/**
 * The bundled thumbnail for a scanned path, with its pixel size so the <img>
 * can reserve its box. Null when the path is not part of the sample.
 */
export function sampleThumb(relPath: string): { src: string; width: number; height: number } | null {
  const size = Object.hasOwn(CURATOR_SAMPLE_THUMBS, relPath) ? CURATOR_SAMPLE_THUMBS[relPath] : undefined;
  if (!size) return null;
  const webp = relPath.replace(/\.[^./]+$/, "") + ".webp";
  const src = `/curator-sample/thumbs/${webp.split("/").map(encodeURIComponent).join("/")}`;
  return { src, width: size[0], height: size[1] };
}
