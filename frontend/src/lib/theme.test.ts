import { afterEach, describe, expect, it, vi } from "vitest";

import { applyTheme, nextTheme, readTheme, serverTheme, subscribeTheme, THEME_BOOT, THEME_KEY } from "@/lib/theme";

function fakeBrowser(saved: Record<string, string> = {}) {
  const store = new Map(Object.entries(saved));
  const dataset: Record<string, string> = {};
  const handlers = new Set<(event: { key: string | null }) => void>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
  const document = { documentElement: { dataset } };
  const window = {
    addEventListener: (_: string, handler: (event: { key: string | null }) => void) => handlers.add(handler),
    removeEventListener: (_: string, handler: (event: { key: string | null }) => void) => handlers.delete(handler),
  };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  return { store, dataset, localStorage, document, fire: (key: string | null) => handlers.forEach((h) => h({ key })) };
}

/** Run the boot script the layout inlines. */
function boot(localStorage: unknown, document: unknown) {
  new Function("localStorage", "document", THEME_BOOT)(localStorage, document);
}

afterEach(() => vi.unstubAllGlobals());

describe("THEME_BOOT", () => {
  it("puts a saved choice on <html>", () => {
    const { dataset, localStorage, document } = fakeBrowser({ [THEME_KEY]: "light" });
    boot(localStorage, document);
    expect(dataset.theme).toBe("light");
  });

  it("leaves <html> alone with no choice, or a bad one", () => {
    const empty = fakeBrowser();
    boot(empty.localStorage, empty.document);
    expect(empty.dataset.theme).toBeUndefined();
    const bad = fakeBrowser({ [THEME_KEY]: '"><script>' });
    boot(bad.localStorage, bad.document);
    expect(bad.dataset.theme).toBeUndefined();
  });

  it("survives storage that throws", () => {
    const { document } = fakeBrowser();
    const blocked = {
      getItem() {
        throw new Error("denied");
      },
    };
    expect(() => boot(blocked, document)).not.toThrow();
  });
});

describe("theme choice", () => {
  it("cycles system, light, dark", () => {
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });

  it("renders as system on the server, whatever is saved", () => {
    fakeBrowser({ [THEME_KEY]: "dark" });
    expect(serverTheme()).toBe("system");
    expect(readTheme()).toBe("dark");
  });

  it("reads anything unknown as system", () => {
    fakeBrowser({ [THEME_KEY]: "sepia" });
    expect(readTheme()).toBe("system");
  });

  it("system clears both the attribute and the saved choice", () => {
    const { store, dataset } = fakeBrowser();
    applyTheme("light");
    expect(dataset.theme).toBe("light");
    expect(store.get(THEME_KEY)).toBe("light");
    applyTheme("system");
    expect(dataset.theme).toBeUndefined();
    expect(store.has(THEME_KEY)).toBe(false);
  });

  it("repaints when another tab changes the choice", () => {
    const { store, dataset, fire } = fakeBrowser();
    const listener = vi.fn();
    const stop = subscribeTheme(listener);
    store.set(THEME_KEY, "dark");
    fire(THEME_KEY);
    expect(dataset.theme).toBe("dark");
    expect(listener).toHaveBeenCalledTimes(1);
    fire("something-else");
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });
});
