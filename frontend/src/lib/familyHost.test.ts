import { describe, expect, it } from "vitest";

import { isFamilyHref } from "@/lib/familyHost";

describe("isFamilyHref", () => {
  it("treats dragonhound.dev and its subdomains as family", () => {
    expect(isFamilyHref("https://dragonhound.dev/")).toBe(true);
    expect(isFamilyHref("https://lightbox.dragonhound.dev/#x")).toBe(true);
    expect(isFamilyHref("https://realms.dragonhound.dev")).toBe(true);
  });

  it("does not match look-alikes, other sites or relative paths", () => {
    expect(isFamilyHref("https://evildragonhound.dev/")).toBe(false);
    expect(isFamilyHref("https://dragonhound.dev.example.com/")).toBe(false);
    expect(isFamilyHref("https://github.com/smk762/argus-studio")).toBe(false);
    expect(isFamilyHref("/curate")).toBe(false);
    expect(isFamilyHref(undefined)).toBe(false);
  });
});
