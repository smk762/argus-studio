import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { opsecFindings, parseDenylist } from "./docsOpsec";

describe("opsecFindings", () => {
  it("passes placeholders, loopback and container paths", () => {
    const ok = [
      "COMFYUI_URL=http://<GPU_HOST>:8188",
      "curl http://localhost:8101/health and http://127.0.0.1:11434",
      "mount the models at /data/models or ~/models",
      "the doc range 192.0.2.10 and version 10.4.1",
    ].join("\n");
    expect(opsecFindings(ok)).toEqual([]);
  });

  it("refuses private, CGNAT and link-local addresses", () => {
    const rules = opsecFindings("10.0.0.5 172.20.1.1 192.168.1.20 100.70.0.1 169.254.1.1 fe80::1 fd12:3456::1").map(
      (f) => f.rule,
    );
    expect(rules).toEqual(["private-ip", "private-ip", "private-ip", "private-ip", "link-local", "private-ip", "link-local"]);
  });

  it("refuses home and host-mount paths and emails, with the line", () => {
    const found = opsecFindings("ok\nsee /home/alice/models\n(/mnt/nas/photos)\nmail someone@example.org");
    expect(found.map((f) => [f.rule, f.line])).toEqual([
      ["home-path", 2],
      ["server-path", 3],
      ["email", 4],
    ]);
  });

  it("reports a denylist hit without echoing the term", () => {
    const found = opsecFindings("the Secret-Host box", parseDenylist(" secret-host ,\n\n"));
    expect(found).toEqual([{ rule: "denylist", match: "denylist entry #1", line: 1 }]);
  });
});

// The gate itself: every published docs source must pass. CI supplies the
// private denylist as the DOCS_OPSEC_DENYLIST secret.
const ROOT = join(__dirname, "..");
const PUBLISHED = [join(ROOT, "app", "docs"), join(ROOT, "content")];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(mdx|ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [p] : [];
  });
}

describe("published docs opsec gate", () => {
  const denylist = parseDenylist(process.env.DOCS_OPSEC_DENYLIST);
  for (const file of PUBLISHED.flatMap(files)) {
    it(relative(ROOT, file), () => {
      expect(opsecFindings(readFileSync(file, "utf8"), denylist)).toEqual([]);
    });
  }
});
