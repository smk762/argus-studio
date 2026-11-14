import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HANDBOOK_MOVED, HANDBOOK_ORIGIN, handbookRedirects, handbookUrl } from "./handbook";

const FRONTEND = join(__dirname, "..", "..");

/** `public/_redirects` as [from, to, status] rows, comments and blanks dropped. */
function cloudflareRules(): [string, string, string][] {
  return readFileSync(join(FRONTEND, "public", "_redirects"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\s+/) as [string, string, string]);
}

/** The prefixes of every rule that sends a /docs path to the handbook. */
const handbookPrefixes = (sources: string[]) =>
  [...new Set(sources.filter((s) => s.startsWith("/docs/")).map((s) => s.split("/")[2]))].sort();

describe("handbook redirects", () => {
  it("builds handbook URLs", () => {
    expect(handbookUrl("packages/lens/cli/")).toBe("https://docs.dragonhound.dev/packages/lens/cli/");
    expect(handbookUrl()).toBe(`${HANDBOOK_ORIGIN}/`);
  });

  it("server build: one permanent :path* redirect per moved prefix", () => {
    expect(handbookRedirects()).toEqual(
      HANDBOOK_MOVED.map((p) => ({
        source: `/docs/${p}/:path*`,
        destination: `https://docs.dragonhound.dev/${p}/:path*`,
        permanent: true,
      })),
    );
  });

  it("static demo: public/_redirects has the bare path and the splat, 301, for each moved prefix", () => {
    const rules = cloudflareRules();
    for (const p of HANDBOOK_MOVED) {
      expect(rules).toContainEqual([`/docs/${p}`, `${HANDBOOK_ORIGIN}/${p}/`, "301"]);
      expect(rules).toContainEqual([`/docs/${p}/*`, `${HANDBOOK_ORIGIN}/${p}/:splat`, "301"]);
    }
    // Nothing else under /docs goes to the handbook, and every handbook rule is a 301.
    const toHandbook = rules.filter(([, to]) => to.startsWith(HANDBOOK_ORIGIN));
    expect(toHandbook.every(([, , status]) => status === "301")).toBe(true);
    expect(handbookPrefixes(toHandbook.map(([from]) => from))).toEqual([...HANDBOOK_MOVED].sort());
  });

  it("the two builds agree: next.config.ts redirects the same prefixes as public/_redirects", async () => {
    const { default: config } = await import("../../next.config");
    expect(config.redirects).toBeTypeOf("function");
    const server = (await config.redirects!()).filter((r) => r.destination.startsWith(HANDBOOK_ORIGIN));
    expect(server.every((r) => r.permanent === true)).toBe(true);
    const fromCloudflare = cloudflareRules()
      .filter(([, to]) => to.startsWith(HANDBOOK_ORIGIN))
      .map(([from]) => from);
    expect(handbookPrefixes(server.map((r) => r.source))).toEqual(handbookPrefixes(fromCloudflare));
  });
});
