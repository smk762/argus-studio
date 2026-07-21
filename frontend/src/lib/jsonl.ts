/**
 * Serialize a list of records as JSONL (newline-delimited JSON), no trailing
 * newline — callers writing a *file* should append one, callers sending a
 * request body should not.
 *
 * Constrained to objects: `JSON.stringify` returns `undefined` for `undefined`,
 * functions and symbols, which `join` would silently render as a blank line.
 */
export function toJsonl(rows: readonly object[]): string {
  return rows.map((r) => JSON.stringify(r)).join("\n");
}
