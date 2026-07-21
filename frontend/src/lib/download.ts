/** Browser file downloads via an object URL + a synthetic anchor click. */

/**
 * Prompt the browser to save `content` as `filename`.
 *
 * The anchor is attached to the document before clicking and removed after:
 * a detached anchor's click is ignored by Firefox and older WebKit. `rel` is
 * set for the same reason `target=_blank` links carry it — the click opens a
 * navigation the page shouldn't be able to reach back into.
 */
export function downloadText(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
