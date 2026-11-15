import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, cspHeaderName, cspMode, cspModeRecognised, newNonce, trustedTypesFor } from "./csp";

describe("cspMode", () => {
  it("enforces unless told otherwise", () => {
    expect(cspMode(undefined)).toBe("enforce");
    expect(cspMode("")).toBe("enforce");
    expect(cspMode("enforce")).toBe("enforce");
    expect(cspMode("nonsense")).toBe("enforce");
  });

  it("reads report-only and the off spellings", () => {
    expect(cspMode(" Report-Only ")).toBe("report-only");
    for (const raw of ["off", "OFF", "0", "false"]) expect(cspMode(raw)).toBe("off");
  });
});

describe("cspModeRecognised", () => {
  it("accepts every spelling cspMode reads, and unset", () => {
    for (const raw of [undefined, "", " Enforce ", "report-only", "OFF", "0", "false"]) {
      expect(cspModeRecognised(raw)).toBe(true);
    }
  });

  it("flags a typo that cspMode would silently enforce", () => {
    for (const raw of ["report_only", "reportonly", "disabled"]) expect(cspModeRecognised(raw)).toBe(false);
  });
});

describe("cspHeaderName", () => {
  it("names the header per mode", () => {
    expect(cspHeaderName("enforce")).toBe("Content-Security-Policy");
    expect(cspHeaderName("report-only")).toBe("Content-Security-Policy-Report-Only");
    expect(cspHeaderName("off")).toBeNull();
  });
});

describe("contentSecurityPolicy", () => {
  it("is a nonce + strict-dynamic script policy with the mandatory companions", () => {
    const policy = contentSecurityPolicy("abc");
    expect(policy).toContain("script-src 'nonce-abc' 'strict-dynamic' 'report-sample'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toContain("unsafe-inline");
  });

  it("allows eval only for the development build", () => {
    expect(contentSecurityPolicy("abc", { dev: true })).toContain("'unsafe-eval'");
  });

  it("does not restrict where the backends live", () => {
    const policy = contentSecurityPolicy("abc");
    expect(policy).not.toMatch(/default-src|connect-src|img-src/);
  });
  // #198: Trusted Types is a dry run first. Next still writes plain strings to
  // script.src / innerHTML, so the directive must never reach an enforced header.
  it("adds require-trusted-types-for only when asked", () => {
    expect(contentSecurityPolicy("abc")).not.toContain("trusted-types");
    expect(contentSecurityPolicy("abc", { trustedTypes: true })).toMatch(/; require-trusted-types-for 'script'$/);
  });
});

describe("trustedTypesFor", () => {
  it("is on for report-only and off for enforce and off", () => {
    expect(trustedTypesFor("report-only")).toBe(true);
    expect(trustedTypesFor("enforce")).toBe(false);
    expect(trustedTypesFor("off")).toBe(false);
  });

  it("never puts the directive on the enforced header", () => {
    for (const mode of ["enforce", "report-only", "off"] as const) {
      const policy = contentSecurityPolicy("abc", { trustedTypes: trustedTypesFor(mode) });
      if (cspHeaderName(mode) === "Content-Security-Policy") expect(policy).not.toContain("trusted-types");
    }
  });
});

describe("newNonce", () => {
  it("is fresh base64 of 16 bytes", () => {
    const a = newNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(newNonce()).not.toBe(a);
  });
});
