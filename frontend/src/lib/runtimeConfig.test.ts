import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveRuntimeConfig, runtimeConfigScript } from "@/lib/runtimeConfig";

afterEach(() => vi.restoreAllMocks());

describe("resolveRuntimeConfig", () => {
  it("defaults every base to the localhost dev port and demo mode", () => {
    const c = resolveRuntimeConfig({});
    expect([c.lensUrl, c.curatorUrl, c.quarryUrl, c.forgeUrl, c.proofUrl, c.atlasUrl]).toEqual([
      "http://localhost:8100",
      "http://localhost:8101",
      "http://localhost:8102",
      "http://localhost:8103",
      "http://localhost:8104",
      "http://localhost:8105",
    ]);
    expect(c.curatorUiMode).toBe("demo");
    expect(c.curatorSourcePath).toBe("");
  });

  it("prefers the runtime name over the legacy NEXT_PUBLIC_* one", () => {
    const c = resolveRuntimeConfig({
      ARGUS_LENS_URL: "https://lens.example",
      NEXT_PUBLIC_API_URL: "https://legacy.example",
      NEXT_PUBLIC_CURATOR_URL: "https://curator.example",
    });
    expect(c.lensUrl).toBe("https://lens.example");
    expect(c.curatorUrl).toBe("https://curator.example");
  });

  it("keeps an explicitly empty URL as same-origin rather than the default", () => {
    expect(resolveRuntimeConfig({ ARGUS_QUARRY_URL: "" }).quarryUrl).toBe("");
    expect(resolveRuntimeConfig({ ARGUS_QUARRY_URL: "/" }).quarryUrl).toBe("");
  });

  it("strips trailing slashes from bases and path prefixes", () => {
    const c = resolveRuntimeConfig({ ARGUS_FORGE_URL: " https://forge.example/// ", ARGUS_PROOF_URL: "/api/proof/" });
    expect(c.forgeUrl).toBe("https://forge.example");
    expect(c.proofUrl).toBe("/api/proof");
  });

  it("warns about a scheme-less base instead of silently accepting it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveRuntimeConfig({ ARGUS_CURATOR_URL: "curator:8101" }).curatorUrl).toBe("curator:8101");
    expect(warn).toHaveBeenCalledOnce();
  });

  it.each([
    ["live", "live"],
    ["LIVE", "live"],
    ["local", "live"],
    ["demo", "demo"],
  ])("maps UI mode %j to %j", (raw, mode) => {
    expect(resolveRuntimeConfig({ ARGUS_CURATOR_UI_MODE: raw }).curatorUiMode).toBe(mode);
  });

  it("falls back to demo on an unknown mode, with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveRuntimeConfig({ ARGUS_CURATOR_UI_MODE: "prod" }).curatorUiMode).toBe("demo");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("does not let an empty runtime mode shadow a legacy live one", () => {
    const c = resolveRuntimeConfig({ ARGUS_CURATOR_UI_MODE: " ", NEXT_PUBLIC_CURATOR_UI_MODE: "live" });
    expect(c.curatorUiMode).toBe("live");
  });
});

describe("runtimeConfigScript", () => {
  it("escapes < so a value cannot close the inline script tag", () => {
    const script = runtimeConfigScript(resolveRuntimeConfig({ ARGUS_LENS_URL: "/x</script><script>alert(1)" }));
    expect(script).not.toContain("</script>");
    expect(script.startsWith("window.__ARGUS_ENV__=")).toBe(true);
  });
});
