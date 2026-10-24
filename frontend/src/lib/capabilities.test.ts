import { describe, expect, it } from "vitest";

import { capabilityOf, capabilityReason, permits } from "@/lib/capabilities";
import { allowsTraining, type ForgeHealth } from "@/lib/forgeApi";
import { allowsEval, type ProofHealth } from "@/lib/proofApi";

describe("permits", () => {
  it("fails safe: only an affirmative true enables a control", () => {
    expect(permits(true)).toBe(true);
    expect(permits(false)).toBe(false);
    expect(permits(null)).toBe(false);
  });
});

describe("capabilityOf", () => {
  const read = (h: { flag?: unknown }) => h.flag;

  it("is unknown without a health payload", () => {
    expect(capabilityOf(null, read, true)).toBeNull();
    expect(capabilityOf(undefined, read, true)).toBeNull();
  });

  it("believes an advertised boolean", () => {
    expect(capabilityOf({ flag: false }, read, true)).toBe(false);
    expect(capabilityOf({ flag: true }, read, false)).toBe(true);
  });

  // `null ?? legacy` would arm a control on a server that never said yes.
  it.each([null, "true", 1, {}])("falls back to legacy for non-boolean %j", (flag) => {
    expect(capabilityOf({ flag }, read, false)).toBe(false);
    expect(capabilityOf({ flag }, read, true)).toBe(true);
  });
});

describe("capabilityReason", () => {
  it("separates a settled refusal from a pending probe", () => {
    expect(capabilityReason(true, "denied")).toBeNull();
    expect(capabilityReason(false, "denied")).toBe("denied");
    expect(capabilityReason(null, "denied")).toMatch(/Checking/);
    expect(capabilityReason(null, "denied", "unreachable")).toBe("unreachable");
  });
});

describe("service capability readers", () => {
  const proof = (read_only?: boolean): ProofHealth => ({ status: "ok", service: "argus-proof", version: "0.2.1", read_only });

  it("proof: read_only is the inverse of allowsEval", () => {
    expect(allowsEval(proof(true))).toBe(false);
    expect(allowsEval(proof(false))).toBe(true);
    expect(allowsEval(proof())).toBe(true);
    expect(allowsEval(null)).toBeNull();
  });

  it("forge: training follows the advertised posture, legacy closed", () => {
    const forge = (training?: unknown): ForgeHealth =>
      ({ status: "ok", service: "argus-forge", version: "0.1.1", training }) as ForgeHealth;
    expect(allowsTraining(null)).toBeNull();
    expect(allowsTraining(forge("enabled"))).toBe(true);
    expect(allowsTraining(forge("disabled"))).toBe(false);
    expect(allowsTraining(forge())).toBe(false);
    expect(allowsTraining(forge("paused"))).toBe(false);
  });
});
