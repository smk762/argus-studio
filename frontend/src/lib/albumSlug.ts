/**
 * Turn an Immich album name into a safe dataset folder name.
 *
 * Unicode-aware: letters and digits of any script survive, so "Портреты 2023"
 * and "Пейзажи 2023" land in different folders instead of both collapsing to
 * "2023". A name with nothing usable falls back to the album id, never to a
 * folder another album would share.
 */
export function albumSlug(name: string, albumId: string): string {
  const slug = name
    .normalize("NFC")
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}_.-]+/gu, "_")
    .replace(/^[_.]+|_+$/g, "");
  if (slug) return slug;
  const id = albumId.replace(/[^A-Za-z0-9_-]+/g, "");
  return id ? `immich_${id}` : "immich";
}
