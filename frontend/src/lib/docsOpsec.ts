/**
 * The opsec gate for published docs (epic argus-studio#169, Approach 6). It
 * refuses, never redacts: a docs page that names a private or link-local
 * address, a home-directory or server path, an email address, or a term on the
 * private denylist fails the check, and the author swaps in a placeholder
 * (`<GPU_HOST>`, `<LAN_HOST>`, `<AGENT_HOST>`) or a container path.
 *
 * Loopback (`localhost`, `127.0.0.1`) and documentation ranges are fine: they
 * name nothing real. The denylist is never committed; CI passes it in through
 * the `DOCS_OPSEC_DENYLIST` secret (comma or newline separated).
 */

export interface OpsecFinding {
  rule: "private-ip" | "link-local" | "home-path" | "server-path" | "email" | "denylist";
  match: string;
  line: number;
}

const IPV4 = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;

function ipv4Rule(a: number, b: number): OpsecFinding["rule"] | null {
  if (a === 10) return "private-ip";
  if (a === 172 && b >= 16 && b <= 31) return "private-ip";
  if (a === 192 && b === 168) return "private-ip";
  if (a === 100 && b >= 64 && b <= 127) return "private-ip"; // CGNAT / tailnets
  if (a === 169 && b === 254) return "link-local";
  return null;
}

const PATTERNS: { rule: OpsecFinding["rule"]; re: RegExp }[] = [
  // IPv6 unique-local and link-local, written with at least one more group.
  { rule: "private-ip", re: /\bf[cd][0-9a-f]{2}:[0-9a-f:]*:[0-9a-f]+\b/gi },
  { rule: "link-local", re: /\bfe80:[0-9a-f:]*\b/gi },
  // A real user's home directory. `~/` alone stays allowed: it names no one.
  { rule: "home-path", re: /(?:^|[\s"'`(=])(\/home\/[A-Za-z0-9._-]+|\/Users\/[A-Za-z0-9._-]+|[A-Z]:\\Users\\[A-Za-z0-9._-]+)/g },
  // Host mount points that only exist on one machine. Container paths
  // (`/data/…`, `/models`, `/app`) are the documented alternative.
  { rule: "server-path", re: /(?:^|[\s"'`(=])(\/(?:mnt|media|srv|volume\d+)\/[A-Za-z0-9._-]+)/g },
  { rule: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g },
];

/** Parses the denylist secret: comma or newline separated, blanks dropped. */
export function parseDenylist(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Every opsec problem in `text`, with its 1-based line. Empty means it may be published. */
export function opsecFindings(text: string, denylist: string[] = []): OpsecFinding[] {
  const out: OpsecFinding[] = [];
  const lines = text.split("\n");
  const lowered = denylist.map((t) => t.toLowerCase());
  lines.forEach((lineText, i) => {
    const line = i + 1;
    for (const m of lineText.matchAll(IPV4)) {
      const octets = m.slice(1, 5).map(Number);
      if (octets.some((o) => o > 255)) continue;
      const rule = ipv4Rule(octets[0], octets[1]);
      if (rule) out.push({ rule, match: m[0], line });
    }
    for (const { rule, re } of PATTERNS) {
      for (const m of lineText.matchAll(re)) out.push({ rule, match: (m[1] ?? m[0]).trim(), line });
    }
    const low = lineText.toLowerCase();
    lowered.forEach((term, j) => {
      // Report the rule, never the term: the denylist is a secret.
      if (low.includes(term)) out.push({ rule: "denylist", match: `denylist entry #${j + 1}`, line });
    });
  });
  return out;
}
