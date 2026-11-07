import { describe, expect, it } from "vitest";

import { defaultFilters, type CuratorFilters, type GuardResult, type ImageResult } from "@/components/curator/types";
import {
  guardBody,
  guardFilterMatches,
  guardProblem,
  matchesGuardView,
  policiesRun,
  policyFlagCounts,
  policyShields,
  policySourceLabel,
  policyVerdicts,
  readPolicyCatalog,
  ruleCounts,
  shieldState,
} from "@/lib/curatorGuard";

const safe: GuardResult = { safe: true, rules: [], policy: "adult" };
const unsafe = (rule: string, policy = "adult"): GuardResult => ({ safe: false, rules: [rule], policy });
const row = (extra: Partial<ImageResult>) => ({ rel_path: "a", ...extra }) as ImageResult;
const filters = (patch: Partial<CuratorFilters>): CuratorFilters => ({ ...defaultFilters(), ...patch });

describe("policyVerdicts", () => {
  it("lists the official verdict once, under the name the scan asked for", () => {
    const official: GuardResult = { safe: true, policy: "custom-abc123" };
    const img = row({ guard: official, guard_variants: { default: official, adult: unsafe("A. Risk") } });
    expect(policyVerdicts(img, "default").map((v) => [v.policy, v.official])).toEqual([
      ["default", true],
      ["adult", false],
    ]);
  });

  it("is empty before any verdict", () => {
    expect(policyVerdicts(row({}))).toEqual([]);
  });
});

describe("policiesRun", () => {
  it("names none on a scan that did not run SingGuard, whatever the config says", () => {
    expect(policiesRun({ guard_config: { enabled: false, policy: "default", variants: [] } })).toEqual([]);
    expect(policiesRun({})).toEqual([]);
  });

  it("lists the official policy first", () => {
    expect(policiesRun({ guard_config: { enabled: true, policy: "adult", variants: ["adult-cinematic"] } })).toEqual([
      "adult",
      "adult-cinematic",
    ]);
  });
});

describe("shieldState", () => {
  it("follows the official verdict and flags a disagreement", () => {
    expect(shieldState(row({}))).toBe("none");
    expect(shieldState(row({ guard: safe }), "adult")).toBe("safe");
    expect(shieldState(row({ guard: safe, guard_variants: { adult: safe, x: unsafe("B") } }), "adult")).toBe("safe-split");
    expect(shieldState(row({ guard: unsafe("A") }), "adult")).toBe("unsafe");
    expect(shieldState(row({ guard: unsafe("A"), guard_variants: { x: safe } }), "adult")).toBe("unsafe-split");
  });
});

describe("matchesGuardView", () => {
  it("treats split as a query that overlaps both", () => {
    expect(matchesGuardView("safe-split", "safe")).toBe(true);
    expect(matchesGuardView("safe-split", "split")).toBe(true);
    expect(matchesGuardView("safe-split", "unsafe")).toBe(false);
    expect(matchesGuardView("unsafe", "split")).toBe(false);
  });

  it("shows a frame with no verdict only under all", () => {
    expect(matchesGuardView("none", "all")).toBe(true);
    expect(matchesGuardView("none", "safe")).toBe(false);
  });
});

describe("policyShields", () => {
  it("gives each policy its own verdict, naming the fired rule from the data", () => {
    const img = row({ guard: safe, guard_variants: { adult: safe, "adult-cinematic": unsafe("B. Depicted Crime", "adult-cinematic") } });
    expect(policyShields(img, ["adult", "adult-cinematic"], "adult")).toEqual([
      { policy: "adult", state: "safe", title: "adult: safe" },
      { policy: "adult-cinematic", state: "unsafe", title: "adult-cinematic: unsafe. B. Depicted Crime" },
    ]);
  });

  it("shows a missing verdict only while the check runs", () => {
    expect(policyShields(row({}), ["adult"], "adult")).toEqual([]);
    expect(policyShields(row({}), ["adult"], "adult", true)[0].state).toBe("pending");
  });
});

describe("ruleCounts", () => {
  it("keeps the same letter apart when policies name it differently", () => {
    const counts = ruleCounts(
      [
        row({ guard: unsafe("B. Real-World Crimes"), guard_variants: { x: unsafe("B. Depicted Crime") } }),
        row({ guard: unsafe("B. Real-World Crimes") }),
        row({ guard: safe }),
      ],
      "adult",
    );
    expect([...counts]).toEqual([
      ["B. Real-World Crimes", 2],
      ["B. Depicted Crime", 1],
    ]);
  });

  it("counts a frame once per rule", () => {
    const img = row({ guard: unsafe("A. Risk"), guard_variants: { x: unsafe("A. Risk") } });
    expect(ruleCounts([img], "adult").get("A. Risk")).toBe(1);
  });
});

describe("policyFlagCounts", () => {
  it("counts per policy", () => {
    const img = row({ guard: safe, guard_variants: { x: unsafe("A") } });
    expect([...policyFlagCounts([img], "adult")]).toEqual([["x", 1]]);
  });
});

describe("guardFilterMatches", () => {
  it("passes everything with no filter on, verdict or not", () => {
    expect(guardFilterMatches(row({}), defaultFilters())).toBe(true);
  });

  it("drops an unchecked frame once a filter is on", () => {
    expect(guardFilterMatches(row({}), filters({ guardUnsafe: true }))).toBe(false);
  });

  it("drops unsafe, keeps safe", () => {
    expect(guardFilterMatches(row({ guard: safe }), filters({ guardUnsafe: true }))).toBe(true);
    expect(guardFilterMatches(row({ guard: unsafe("A. Risk") }), filters({ guardUnsafe: true }))).toBe(false);
  });

  it("with rules only, keeps an unsafe frame whose rules are unlisted", () => {
    const img = row({ guard: unsafe("A. Risk") });
    expect(guardFilterMatches(img, filters({ guardRules: ["B. Other"] }))).toBe(true);
    expect(guardFilterMatches(img, filters({ guardRules: ["a. risk"] }))).toBe(false);
  });

  it("drops an unsafe frame that names no rule, as it can't be shown to be unlisted", () => {
    expect(guardFilterMatches(row({ guard: { safe: false, rules: [] } }), filters({ guardRules: ["A. Risk"] }))).toBe(false);
  });

  it("reads the listed policies, and any failure drops the frame", () => {
    const img = row({ guard: safe, guard_variants: { adult: safe, x: unsafe("A") } });
    expect(guardFilterMatches(img, filters({ guardUnsafe: true }))).toBe(true);
    expect(guardFilterMatches(img, filters({ guardUnsafe: true, guardPolicies: ["adult"] }))).toBe(true);
    expect(guardFilterMatches(img, filters({ guardUnsafe: true, guardPolicies: ["adult", "x"] }))).toBe(false);
  });

  it("treats a variant whose check failed as unchecked, not as the official verdict", () => {
    const img = row({ guard: safe, guard_variants: { adult: safe } });
    expect(guardFilterMatches(img, filters({ guardUnsafe: true, guardPolicies: ["x"] }))).toBe(false);
  });

  it("falls back to the official verdict on a scan without variants", () => {
    expect(guardFilterMatches(row({ guard: safe }), filters({ guardUnsafe: true, guardPolicies: ["adult"] }))).toBe(true);
  });
});

describe("policy choice", () => {
  it("flags a name this curator does not offer", () => {
    expect(guardProblem({ policy: "gone", variants: [] }, ["default"])).toMatch(/gone/);
    expect(guardProblem({ policy: "default", variants: ["gone"] }, ["default"])).toMatch(/gone/);
    expect(guardProblem({ policy: "default", variants: [] }, ["default"])).toBeNull();
    expect(guardProblem({ policy: "gone", variants: [] }, [])).toBeNull();
  });

  it("sends nothing for the default, and drops repeats", () => {
    expect(guardBody({ policy: "default", variants: [] })).toBeNull();
    expect(guardBody({ policy: "adult", variants: ["adult", "x", "x"] })).toEqual({ policy: "adult", variants: ["x"] });
  });
});

describe("the policy catalog", () => {
  it("reads defensively", () => {
    expect(readPolicyCatalog(null)).toEqual([]);
    expect(readPolicyCatalog({ policies: "nope" })).toEqual([]);
    expect(readPolicyCatalog({ policies: [{ name: "adult" }, { text: "no name" }, null] })).toEqual([{ name: "adult" }]);
  });

  it("labels a source, including one newer than this client", () => {
    expect(policySourceLabel("builtin")).toBe("built in");
    expect(policySourceLabel("later")).toBe("later");
    expect(policySourceLabel(null)).toBe("unknown");
  });
});
