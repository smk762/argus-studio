/** Serialize a list of records as JSONL (newline-delimited JSON), no trailing newline. */
export function toJsonl(rows: readonly unknown[]): string {
  return rows.map((r) => JSON.stringify(r)).join("\n");
}
