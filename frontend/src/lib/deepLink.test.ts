import { describe, expect, it } from "vitest";

import { mergeQuery } from "@/lib/deepLink";

describe("mergeQuery", () => {
  it("sets a key and keeps the others", () => {
    expect(mergeQuery("?view=sources", { item: "abc" })).toBe("?view=sources&item=abc");
  });

  it("replaces a key's value", () => {
    expect(mergeQuery("?photo=1", { photo: "2" })).toBe("?photo=2");
  });

  it("removes a key set to null, and leaves no bare ?", () => {
    expect(mergeQuery("?photo=1&view=sources", { photo: null })).toBe("?view=sources");
    expect(mergeQuery("?photo=1", { photo: null })).toBe("");
  });

  it("escapes values", () => {
    expect(mergeQuery("", { item: "a b&c" })).toBe("?item=a+b%26c");
  });
});
