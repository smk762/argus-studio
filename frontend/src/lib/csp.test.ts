import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, cspHeaderName, cspMode, newNonce } from "./csp";

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
});

describe("newNonce", () => {
  it("is fresh base64 of 16 bytes", () => {
    const a = newNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(newNonce()).not.toBe(a);
  });
});
