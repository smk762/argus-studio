"use client";

import { useEffect, useState } from "react";
import { getDoctor, type AtlasDoctor } from "@/lib/atlasApi";
import { doctorChecks, doctorSummary, type DoctorState } from "@/lib/atlasView";

const STATE_DOT: Record<DoctorState, string> = {
  ok: "bg-accent-green",
  off: "bg-muted",
  fail: "bg-accent-red",
};

/**
 * What the atlas host can do (`GET /doctor`). Collapsed and fetched only when
 * opened, because the probe calls the bake backend and a dead one is slow.
 */
export function DoctorPanel() {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [doctor, setDoctor] = useState<AtlasDoctor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const report = await getDoctor(ctrl.signal);
        setDoctor(report);
        setError(null);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setDoctor(null);
        setError(err instanceof Error ? err.message : "Could not reach /doctor");
      }
    })();
    return () => ctrl.abort();
  }, [open, attempt]);

  const checks = doctor ? doctorChecks(doctor) : [];

  return (
    <section className="rounded-xl border border-border bg-surface/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-3 text-left"
      >
        <span className="text-sm font-medium text-foreground">Host doctor</span>
        <span className="text-xs text-muted">
          {!open ? "GDAL, tiler, PMTiles packer and bake backend" : doctor ? doctorSummary(checks) : error ? "" : "Checking…"}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-5 py-4">
          {error && <p className="text-xs text-accent-red-ink">{error}</p>}
          {doctor && (
            <>
              <ul className="space-y-1">
                {checks.map((c) => (
                  <li key={c.label} className="flex items-baseline gap-2 text-xs">
                    <span className={`h-2 w-2 shrink-0 self-center rounded-full ${STATE_DOT[c.state]}`} />
                    <span className="w-28 shrink-0 text-muted">{c.label}</span>
                    <span className="min-w-0 break-words font-mono text-[11px] text-foreground">{c.detail}</span>
                  </li>
                ))}
              </ul>
              <dl className="grid gap-x-6 gap-y-0.5 font-mono text-[11px] text-muted sm:grid-cols-2">
                <div><dt className="inline">jobs </dt><dd className="inline break-all text-foreground/70">{doctor.jobs_dir}</dd></div>
                <div><dt className="inline">dem </dt><dd className="inline break-all text-foreground/70">{doctor.dem_dir}</dd></div>
                <div><dt className="inline">models </dt><dd className="inline break-all text-foreground/70">{doctor.models_dir}</dd></div>
                <div><dt className="inline">workflow </dt><dd className="inline break-all text-foreground/70">{doctor.workflow}</dd></div>
              </dl>
            </>
          )}
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-surface-hover"
          >
            Check again
          </button>
        </div>
      )}
    </section>
  );
}
