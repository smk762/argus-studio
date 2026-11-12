import { describe, expect, it } from "vitest";

import { FIRST_ROW, tileLoading } from "./imageLoading";

describe("tileLoading", () => {
  it("loads the first row eagerly and lazy-loads the rest", () => {
    expect(tileLoading(0)).toBeUndefined();
    expect(tileLoading(FIRST_ROW - 1)).toBeUndefined();
    expect(tileLoading(FIRST_ROW)).toBe("lazy");
    expect(tileLoading(500)).toBe("lazy");
  });

  it("takes a narrower grid's row length", () => {
    expect(tileLoading(2, 3)).toBeUndefined();
    expect(tileLoading(3, 3)).toBe("lazy");
  });
});
