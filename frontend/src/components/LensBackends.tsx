"use client";

import { backendChoices, type LensBackendInfo } from "@/lib/lensApi";

interface Props {
  info: LensBackendInfo | null;
  /** The picked caption backend; "" = the server default. */
  choice: string;
  onChoose: (backend: string) => void;
}

/**
 * The lens server's caption backends (#69). Lists every registered backend
 * with why it can't run, and, on a lens with per-request selection (lens#107),
 * lets the visitor caption with another one the server allows. The server's
 * `ARGUS_ALLOWED_BACKENDS` pin is what stops a public host loading extra
 * models: this only offers what it permits.
 */
export function LensBackends({ info, choice, onChoose }: Props) {
  if (!info || info.backends.length === 0) return null;
  const { backends } = info;
  const choices = backendChoices(info);
  const others = choices.filter((b) => b.name !== info.default);
  // A choice the server no longer offers shows (and is sent) as the default.
  const value = others.some((b) => b.name === choice) ? choice : "";
  const available = backends.filter((b) => b.available).length;

  return (
    <div className="mt-4 space-y-2">
      {others.length > 0 && (
        <label className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-foreground/80">Caption backend</span>
          <select
            value={value}
            onChange={(e) => onChoose(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-purple/50"
          >
            <option value="">Server default ({info.default})</option>
            {others.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
                {b.requires_gpu ? " (GPU)" : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted">
            The model that reads the image. Separate from the target backend, which sizes the caption.
          </span>
        </label>
      )}

      <details className="group rounded-lg border border-border bg-surface/40 px-3 py-2 text-sm">
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
          {info.default ? (
            <>
              Requests use <code className="font-mono">{info.default}</code> unless another is picked above. The
              server decides which it allows (<code className="font-mono">ARGUS_ALLOWED_BACKENDS</code>).
            </>
          ) : (
            <>
              This lens chooses its backend when it starts (<code className="font-mono">--backend</code> or{" "}
              <code className="font-mono">ARGUS_BACKEND</code>) and can&apos;t switch per request. A lens with per-request selection (lens#107) can.
            </>
          )}{" "}
          Each caption shows the backend that made it.
        </p>
        <ul className="mt-2 divide-y divide-border">
          {backends.map((b) => {
            const status = !b.available ? "unavailable" : b.allowed === false ? "not allowed here" : "available";
            return (
              <li key={b.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
                <span
                  className={`h-2 w-2 shrink-0 self-center rounded-full ${status === "available" ? "bg-accent-green" : "bg-border"}`}
                  aria-hidden
                />
                <span className="font-mono text-xs text-foreground">{b.name}</span>
                {b.name === info.default && (
                  <span className="rounded border border-accent-purple/40 px-1 text-[10px] text-accent-purple-ink">default</span>
                )}
                <span className="text-[11px] text-muted">
                  {[b.kind, b.requires_gpu ? "GPU" : null].filter(Boolean).join(" · ")}
                </span>
                <span className={`ml-auto text-[11px] ${status === "available" ? "text-accent-green-ink" : "text-muted"}`}>
                  {status}
                </span>
                {!b.available && b.reason && <span className="w-full pl-5 text-[11px] text-muted">{b.reason}</span>}
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}
