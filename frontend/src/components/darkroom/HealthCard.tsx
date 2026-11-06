"use client";

import { darkroomUrl } from "@/lib/curatorEnv";

import { useDarkroom } from "./DarkroomProvider";
import { Button, Card, SectionTitle, Spinner } from "./ui";

const BACKENDS: { key: keyof NonNullable<ReturnType<typeof useDarkroom>["health"]>["backends"]; label: string; note: string }[] = [
  { key: "singguard", label: "SingGuard", note: "Darkroom never runs unguarded; Generate waits for this." },
  { key: "comfyui", label: "ComfyUI", note: "Renders the image." },
  { key: "nudenet", label: "NudeNet", note: "Exposure score. Without it SFW generation is refused." },
  { key: "ollama", label: "Ollama", note: "Optional prompt expansion. Never a guard." },
  { key: "age", label: "Age check", note: "MiVOLO estimate from detected faces, when the extra is installed." },
];

/** What `/health` says about darkroom and the servers behind it. */
export function HealthCard() {
  const { health, error, loading, reload } = useDarkroom();
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>Darkroom</SectionTitle>
        {loading ? <Spinner /> : <Button small onClick={reload}>Refresh</Button>}
      </div>
      <p className="mt-1 break-all font-mono text-xs text-muted">{darkroomUrl()}</p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-accent-red">
          Not reachable: {error}
        </p>
      ) : health ? (
        <>
          <p className="mt-2 text-sm text-foreground/70">
            Version {health.version}
            {health.mock ? " (fixture mock)" : ""}. Default policy <span className="font-mono">{health.default_policy}</span>, thinking <span className="font-mono">{health.thinking}</span>.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {BACKENDS.map(({ key, label, note }) => {
              const up = health.backends[key];
              return (
                <li key={key} className="flex items-center gap-2" title={note}>
                  <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${up ? "bg-accent-green" : "bg-accent-red"}`} />
                  <span className="text-foreground">{label}</span>
                  <span className="text-xs text-muted">{up ? "reachable" : "unreachable"}</span>
                </li>
              );
            })}
          </ul>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <li>{health.nsfw_allowed ? "NSFW policies may enforce (--allow-nsfw)" : "NSFW policies are advisory only"}</li>
            <li>{health.sfw_available ? "SFW generation available" : "SFW generation refused: no NudeNet"}</li>
            {health.read_only ? <li className="text-accent-amber">read-only</li> : null}
            {health.devmode ? <li className="text-accent-amber">devmode</li> : null}
          </ul>
        </>
      ) : null}
    </Card>
  );
}
