"use client";

import type { LensBackend } from "@/lib/lensApi";

/**
 * What the lens server has registered and whether each backend can run (#69).
 * Read-only: lens picks its captioning backend when it starts
 * (`--backend` / `ARGUS_BACKEND`), and no caption endpoint takes one per
 * request. Each result names the backend that produced it.
 */
export function LensBackends({ backends }: { backends: readonly LensBackend[] }) {
  if (backends.length === 0) return null;
  const available = backends.filter((b) => b.available).length;
  return (
    <details className="group mt-4 rounded-lg border border-border bg-surface/40 px-3 py-2 text-sm">
      <summary className="cursor-pointer list-none text-foreground/80">
        <span className="mr-1.5 inline-block text-muted transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
        Backends on this lens server{" "}
        <span className="text-xs text-muted">
          ({available} of {backends.length} available)
        </span>
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Lens chooses its backend when it starts (<code className="font-mono">--backend</code> or{" "}
        <code className="font-mono">ARGUS_BACKEND</code>), so it can&apos;t be switched from here. Each caption shows
        the backend that made it.
      </p>
      <ul className="mt-2 divide-y divide-border">
        {backends.map((b) => (
          <li key={b.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
            <span
              className={`h-2 w-2 shrink-0 self-center rounded-full ${b.available ? "bg-accent-green" : "bg-border"}`}
              aria-hidden
            />
            <span className="font-mono text-xs text-foreground">{b.name}</span>
            <span className="text-[11px] text-muted">
              {[b.kind, b.requires_gpu ? "GPU" : null].filter(Boolean).join(" · ")}
            </span>
            <span className={`ml-auto text-[11px] ${b.available ? "text-accent-green-ink" : "text-muted"}`}>
              {b.available ? "available" : "unavailable"}
            </span>
            {!b.available && b.reason && (
              <span className="w-full pl-5 text-[11px] text-muted">{b.reason}</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
