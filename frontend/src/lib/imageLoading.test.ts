import { describe, expect, it } from "vitest";

import { FIRST_ROW, inFirstRow, tileLoading } from "./imageLoading";

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

  it("agrees with inFirstRow", () => {
    expect(inFirstRow(FIRST_ROW - 1)).toBe(true);
    expect(inFirstRow(FIRST_ROW)).toBe(false);
    expect(inFirstRow(2, 3)).toBe(true);
    expect(inFirstRow(3, 3)).toBe(false);
  });
});
