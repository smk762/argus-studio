/**
 * Packs caption fragments into a token budget the way lens does: highest
 * priority first, and a fragment that does not fit is skipped while the later
 * (lower-priority, possibly smaller) ones still get their chance. So what is
 * dropped is "whatever didn't fit", not necessarily the lowest-priority tail.
 */
export function packFragments<F extends { tokens: number }>(
  fragments: readonly F[],
  budget: number,
): (F & { fits: boolean })[] {
  const rows: (F & { fits: boolean })[] = [];
  let spent = 0;
  for (const f of fragments) {
    const fits = spent + f.tokens <= budget;
    if (fits) spent += f.tokens;
    rows.push({ ...f, fits });
  }
  return rows;
}
