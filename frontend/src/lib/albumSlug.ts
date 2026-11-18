/** Room for the name part: 200 bytes plus the "_" + 8-char id suffix stays well under the 255-byte name limit. */
const MAX_NAME_BYTES = 200;
const ID_SUFFIX_CHARS = 8;

/** Cut a string to at most `max` UTF-8 bytes, never inside a code point. */
function truncateUtf8(text: string, max: number): string {
  const encoder = new TextEncoder();
  let bytes = 0;
  let out = "";
  for (const ch of text) {
    const n = encoder.encode(ch).length;
    if (bytes + n > max) break;
    bytes += n;
    out += ch;
  }
  return out;
}

/**
 * Turn an Immich album name into a safe dataset folder name.
 *
 * Unicode-aware: letters and digits of any script survive, so "Портреты 2023"
 * and "Пейзажи 2023" land in different folders instead of both collapsing to
 * "2023". The slug is lossy ("Portraits 2023" and "Portraits / 2023" read the
 * same), so a short suffix from the album id keeps every album in its own
 * folder; the name part is capped in UTF-8 bytes, so a long non-Latin name
 * still fits a filesystem's 255-byte name limit. A name with nothing usable
 * falls back to the album id, never to a folder another album would share.
 */
export function albumSlug(name: string, albumId: string): string {
  const id = albumId.replace(/[^A-Za-z0-9_-]+/g, "");
  const slug = truncateUtf8(
    name
      .normalize("NFC")
      .trim()
      .replace(/[^\p{L}\p{M}\p{N}_.-]+/gu, "_")
      .replace(/^[_.]+|_+$/g, ""),
    MAX_NAME_BYTES,
  ).replace(/_+$/, "");
  if (slug) return id ? `${slug}_${id.slice(0, ID_SUFFIX_CHARS)}` : slug;
  return id ? `immich_${id}` : "immich";
}
