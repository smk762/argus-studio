"use client";

import { useSyncExternalStore, type ReactNode } from "react";

import { applyTheme, nextTheme, readTheme, serverTheme, subscribeTheme, THEME_ORDER, type Theme } from "@/lib/theme";

const LABEL: Record<Theme, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

const ICON: Record<Theme, ReactNode> = {
  system: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  dark: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
};

/**
 * Cycles system, light, dark. All three icons are in the markup and globals.css
 * shows the one matching `data-theme`: the server can't know the choice, so an
 * icon picked in React would show the wrong one until hydration.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, serverTheme);
  const next = nextTheme(theme);
  const label = `${LABEL[theme]}. Switch to ${LABEL[next].toLowerCase()}.`;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => applyTheme(next)}
      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      {THEME_ORDER.map((name) => (
        <svg
          key={name}
          viewBox="0 0 24 24"
          aria-hidden="true"
          data-theme-icon={name}
          className="h-4.5 w-4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ICON[name]}
        </svg>
      ))}
    </button>
  );
}
