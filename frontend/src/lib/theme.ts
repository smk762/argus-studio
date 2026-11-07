/**
 * The light/dark choice, ported from argus-safelight. It is `data-theme` on
 * <html>: "light" or "dark", or absent for the system preference, which
 * globals.css follows with a media query and so needs no script at all.
 */

export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "argus-studio-theme";
export const THEME_ORDER: readonly Theme[] = ["system", "light", "dark"];

/**
 * Inlined at the top of <head>, so a saved choice is on <html> before the first
 * paint and before hydration. It can only ever add `data-theme`, which is why
 * <html> carries `suppressHydrationWarning`. Like the runtime-config script it
 * has no CSP nonce; if a `script-src` policy blocks it the page follows the
 * system preference and the toggle still works until the next load.
 */
export const THEME_BOOT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

const listeners = new Set<() => void>();

function parseTheme(saved: string | null): Theme {
  return saved === "light" || saved === "dark" ? saved : "system";
}

export function readTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

/** What the server renders. It can't see the choice, so the toggle's own markup must not depend on it. */
export const serverTheme = (): Theme => "system";

function setRoot(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/** Applies the choice and remembers it. */
export function applyTheme(theme: Theme): void {
  setRoot(theme);
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  for (const listener of listeners) listener();
}

/** Calls `listener` on a change here or in another tab, which also repaints this one. */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_KEY && event.key !== null) return;
    setRoot(readTheme());
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function nextTheme(theme: Theme): Theme {
  return THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
}
