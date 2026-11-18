/**
 * The opsec gate for published docs (epic argus-studio#169, Approach 6). The
 * rules live in `scripts/opsec.mjs`; this module re-exports them for the vitest
 * gate over Studio's own /docs pages. It refuses, never redacts: a docs page that names a private or
 * link-local address, a home-directory or server path, an email address, or a
 * term on the private denylist fails, and the author swaps in a placeholder
 * (`<GPU_HOST>`, `<LAN_HOST>`, `<AGENT_HOST>`) or a container path.
 *
 * Loopback (`localhost`, `127.0.0.1`) and documentation ranges are fine: they
 * name nothing real. The denylist is never committed; CI passes it in through
 * the `DOCS_OPSEC_DENYLIST` secret (comma or newline separated).
 */
import { opsecFindings as findings, parseDenylist as parse } from "../../scripts/opsec.mjs";

export interface OpsecFinding {
  rule: "private-ip" | "link-local" | "home-path" | "server-path" | "email" | "denylist";
  match: string;
  line: number;
}

/** Parses the denylist secret: comma or newline separated, blanks dropped. */
export function parseDenylist(raw: string | undefined): string[] {
  return parse(raw);
}

/** Every opsec problem in `text`, with its 1-based line. Empty means it may be published. */
export function opsecFindings(text: string, denylist: string[] = []): OpsecFinding[] {
  return findings(text, denylist);
}

/**
 * Why the gate cannot run its denylist check, or null when it can. Under CI
 * (`CI` set) a missing or empty `DOCS_OPSEC_DENYLIST` is a failure, not a
 * silent skip: a misnamed or rotated secret would otherwise pass every page.
 * A run that is known to get no secrets (a fork PR) says so explicitly with
 * `DOCS_OPSEC_DENYLIST_OPTIONAL=1`; a local run without CI may go without.
 */
export function denylistProblem(env: Record<string, string | undefined>): string | null {
  if (parseDenylist(env.DOCS_OPSEC_DENYLIST).length > 0) return null;
  if (!env.CI || env.DOCS_OPSEC_DENYLIST_OPTIONAL === "1") return null;
  return "DOCS_OPSEC_DENYLIST is empty under CI: the denylist check would be skipped. Supply the secret, or set DOCS_OPSEC_DENYLIST_OPTIONAL=1 for a run that gets no secrets.";
}
