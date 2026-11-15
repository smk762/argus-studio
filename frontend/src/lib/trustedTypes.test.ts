import { describe, expect, it } from "vitest";

import { ownChunkScriptUrl, trustedTypesPolicyScript } from "@/lib/trustedTypes";

const BASE = "https://studio.example/curate";

describe("ownChunkScriptUrl", () => {
  it("accepts this origin's Next chunks, relative or absolute, with a query (Next's ?dpl=)", () => {
    expect(ownChunkScriptUrl("/_next/static/chunks/a.js?dpl=abc", BASE)).toMatch(/a\.js\?dpl=abc$/);
    expect(ownChunkScriptUrl("/_next/static/chunks/2ra8yvy272nl0.js", BASE)).toBe(
      "https://studio.example/_next/static/chunks/2ra8yvy272nl0.js",
    );
    expect(ownChunkScriptUrl("https://studio.example/_next/static/chunks/turbopack-2u1d16houkiyo.js", BASE)).toMatch(
      /turbopack-2u1d16houkiyo\.js$/,
    );
  });

  it.each([
    "https://evil.example/_next/static/chunks/a.js",
    "//evil.example/_next/static/chunks/a.js",
    "/_next/static/chunks/../../api/x.js",
    "/_next/static/media/a.js",
    "/_next/static/chunks/a.json",
    "/dh-theme.js",
    "data:text/javascript,alert(1)",
    "javascript:alert(1)",
    "http://[::1",
  ])("refuses %j (null: reported under report-only, blocked once enforced)", (input) => {
    expect(ownChunkScriptUrl(input, BASE)).toBeNull();
  });
});

describe("trustedTypesPolicyScript", () => {
  it("registers a default policy with only createScriptURL, once", () => {
    const created: { name: string; rules: Record<string, (s: string) => string> }[] = [];
    const tt = {
      defaultPolicy: null as unknown,
      createPolicy(name: string, rules: Record<string, (s: string) => string>) {
        created.push({ name, rules });
        this.defaultPolicy = rules;
        return rules;
      },
    };
    const run = new Function("window", "location", trustedTypesPolicyScript());
    run({ trustedTypes: tt }, { href: BASE });
    run({ trustedTypes: tt }, { href: BASE });
    expect(created).toHaveLength(1);
    expect(created[0].name).toBe("default");
    expect(Object.keys(created[0].rules)).toEqual(["createScriptURL"]);
    expect(created[0].rules.createScriptURL("/_next/static/chunks/a.js")).toBe("https://studio.example/_next/static/chunks/a.js");
    expect(created[0].rules.createScriptURL("https://evil.example/x.js")).toBeNull();
  });

  it("does nothing where Trusted Types is missing", () => {
    expect(() => new Function("window", "location", trustedTypesPolicyScript())({}, { href: BASE })).not.toThrow();
  });
});
