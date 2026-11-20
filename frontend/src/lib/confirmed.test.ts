import { afterEach, describe, expect, it, vi } from "vitest";

import { askConfirm, confirmedBy, spendConfirmation, Unconfirmed, type Confirmed } from "@/lib/confirmed";

afterEach(() => vi.unstubAllGlobals());

describe("confirmed", () => {
  it("mints one from the user's own click, and none from a scripted one", () => {
    expect(() => spendConfirmation(confirmedBy({ isTrusted: true }))).not.toThrow();
    expect(() => confirmedBy({ isTrusted: false })).toThrow(Unconfirmed);
    expect(() => confirmedBy(undefined as unknown as { isTrusted: boolean })).toThrow(Unconfirmed);
  });

  it("asks with the browser's dialog and gives nothing on a no", () => {
    const asked: string[] = [];
    let answer = false;
    vi.stubGlobal("window", { confirm: (message: string) => (asked.push(message), answer) });
    expect(askConfirm("Delete it?")).toBeNull();
    answer = true;
    const yes = askConfirm("Delete it?");
    expect(yes).not.toBeNull();
    expect(asked).toEqual(["Delete it?", "Delete it?"]);
    expect(() => spendConfirmation(yes!)).not.toThrow();
  });

  it("is good for one call", () => {
    const yes = confirmedBy({ isTrusted: true });
    spendConfirmation(yes);
    expect(() => spendConfirmation(yes)).toThrow(Unconfirmed);
  });

  it("refuses a forged one", () => {
    expect(() => spendConfirmation({} as Confirmed)).toThrow(Unconfirmed);
    expect(() => spendConfirmation(true as unknown as Confirmed)).toThrow(Unconfirmed);
    expect(() => spendConfirmation(undefined as unknown as Confirmed)).toThrow(Unconfirmed);
  });
});
