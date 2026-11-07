"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";

import { NSFW_THRESHOLD_MAX, NSFW_THRESHOLD_MIN, READ_ONLY_BLOCK, SIZES, canExpand, generateBlock, parseTriggerWords, randomSeed } from "@/lib/darkroom/compose";
import { THINKING_MODES, type ThinkingMode } from "@/lib/darkroomApi";

import { useCompose } from "./ComposeProvider";
import { useDarkroom } from "./DarkroomProvider";
import { PolicyPicker } from "./PolicyPicker";
import { Button, SectionTitle, Spinner } from "./ui";

const FIELD = "w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted disabled:opacity-60";
const LABEL = "block text-xs uppercase tracking-wide text-muted";

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

type DraftNumberProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "min" | "max" | "onChange" | "onBlur"> & {
  value: number;
  min: number;
  max: number;
  onValue: (value: number) => void;
};

/** A number field that lets a half-typed value sit in the box and passes on only what is inside the limits. Leaving it shows the value in force. */
function DraftNumber({ value, min, max, onValue, ...input }: DraftNumberProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      {...input}
      type="number"
      min={min}
      max={max}
      value={draft ?? value}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const parsed = Number(text);
        if (text !== "" && parsed >= min && parsed <= max) onValue(parsed);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

/** Keeps the text as typed, since the parsed words drop the comma or space a next word starts from. A change from outside the box replaces it. */
function TriggerWordsInput({ name, words, onWords }: { name: string; words: string[]; onWords: (words: string[]) => void }) {
  const [draft, setDraft] = useState(words.join(", "));
  const current = parseTriggerWords(draft).join("\n") === words.join("\n");
  return (
    <input
      type="text"
      value={current ? draft : words.join(", ")}
      placeholder="none"
      aria-label={`Trigger words for ${name}`}
      onChange={(event) => {
        setDraft(event.target.value);
        onWords(parseTriggerWords(event.target.value));
      }}
      className={`${FIELD} w-36`}
    />
  );
}

/** The compose form: prompt, models, sampling, policies, thinking mode and the NudeNet blur threshold. Lives in `ComposeDialog`. */
export function ComposeForm() {
  const { health, policies, models, error } = useDarkroom();
  const { compose, ready, update, check, preflight, start, stop, running } = useCompose();
  const ollamaDown = !canExpand(health);
  const checking = preflight.state === "checking";
  const block = generateBlock(health, error, compose, policies);
  const readOnly = health?.read_only === true;

  return (
    <div className="space-y-5">
      {!ready && !error ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Spinner /> Loading darkroom&apos;s catalogue…
        </p>
      ) : null}

      <Field label="Prompt" htmlFor="prompt">
        <textarea id="prompt" rows={4} value={compose.userPrompt} onChange={(event) => update({ userPrompt: event.target.value })} placeholder="What to generate" className={FIELD} />
      </Field>
      <Field label="Negative prompt" htmlFor="negative" hint="Always part of pre-flight, labelled as what the image must not show.">
        <textarea id="negative" rows={2} value={compose.negativePrompt} onChange={(event) => update({ negativePrompt: event.target.value })} className={FIELD} />
      </Field>
      <div className="flex items-start gap-2">
        <input type="checkbox" id="expand" checked={compose.expand && !ollamaDown} disabled={ollamaDown} onChange={(event) => update({ expand: event.target.checked })} className="mt-1 accent-accent-purple" />
        <label htmlFor="expand" className={`text-sm ${ollamaDown ? "text-muted" : "text-foreground"}`}>
          Expand the prompt with Ollama
          <span className="block text-xs text-muted">{ollamaDown ? "Disabled: /health reports Ollama unreachable." : "The expanded prompt is shown after Check, and it is the text that gets checked."}</span>
        </label>
      </div>

      <div className="space-y-3">
        <SectionTitle>Models</SectionTitle>
        <Field label="Checkpoint" htmlFor="checkpoint">
          <select id="checkpoint" value={compose.checkpoint} onChange={(event) => update({ checkpoint: event.target.value })} className={FIELD} disabled={!models}>
            {models?.checkpoints.map((checkpoint) => (
              <option key={checkpoint.name} value={checkpoint.name}>
                {checkpoint.name}
              </option>
            ))}
          </select>
        </Field>
        <div>
          <span className={LABEL}>LoRAs</span>
          <ul className="mt-1 space-y-1.5">
            {compose.loras.map((lora, index) => (
              <li key={lora.name} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground" title={lora.name}>
                  {lora.name}
                </span>
                <label className="flex items-center gap-1 text-xs text-muted">
                  weight
                  <DraftNumber
                    step="0.05"
                    min={-2}
                    max={2}
                    value={lora.weight}
                    aria-label={`Weight for ${lora.name}`}
                    onValue={(weight) => update((current) => ({ ...current, loras: current.loras.map((entry, i) => (i === index ? { ...entry, weight } : entry)) }))}
                    className={`${FIELD} w-20`}
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-muted">
                  trigger words
                  <TriggerWordsInput name={lora.name} words={lora.trigger_words} onWords={(trigger_words) => update((current) => ({ ...current, loras: current.loras.map((entry, i) => (i === index ? { ...entry, trigger_words } : entry)) }))} />
                </label>
                <Button small aria-label={`Remove ${lora.name}`} onClick={() => update((current) => ({ ...current, loras: current.loras.filter((_, i) => i !== index) }))}>
                  ×
                </Button>
              </li>
            ))}
          </ul>
          {models && models.loras.some((lora) => !compose.loras.some((chosen) => chosen.name === lora.name)) ? (
            <select
              aria-label="Add a LoRA"
              value=""
              onChange={(event) => {
                const name = event.target.value;
                if (name) update((current) => ({ ...current, loras: [...current.loras, { name, weight: 1, trigger_words: [...(models.loras.find((known) => known.name === name)?.trigger_words ?? [])] }] }));
              }}
              className={`${FIELD} mt-1.5`}
            >
              <option value="">Add a LoRA…</option>
              {models.loras
                .filter((lora) => !compose.loras.some((chosen) => chosen.name === lora.name))
                .map((lora) => (
                  <option key={lora.name} value={lora.name}>
                    {lora.name}
                  </option>
                ))}
            </select>
          ) : null}
          <p className="mt-1 text-xs text-muted">The trigger words you enter are appended to the final prompt by darkroom, after any expansion. They are checked with it.</p>
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle>Sampling</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sampler" htmlFor="sampler">
            <select id="sampler" value={compose.sampling.sampler} onChange={(event) => update((c) => ({ ...c, sampling: { ...c.sampling, sampler: event.target.value } }))} className={FIELD} disabled={!models}>
              {(models?.samplers ?? [compose.sampling.sampler]).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label="Scheduler" htmlFor="scheduler">
            <select id="scheduler" value={compose.sampling.scheduler} onChange={(event) => update((c) => ({ ...c, sampling: { ...c.sampling, scheduler: event.target.value } }))} className={FIELD} disabled={!models}>
              {(models?.schedulers ?? [compose.sampling.scheduler]).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label="Steps" htmlFor="steps">
            <DraftNumber id="steps" min={1} max={150} value={compose.sampling.steps} onValue={(steps) => update((c) => ({ ...c, sampling: { ...c.sampling, steps: Math.floor(steps) } }))} className={FIELD} />
          </Field>
          <Field label="CFG" htmlFor="cfg">
            <input id="cfg" type="number" min={0} max={30} step={0.5} value={compose.sampling.cfg} onChange={(event) => update((c) => ({ ...c, sampling: { ...c.sampling, cfg: Number(event.target.value) } }))} className={FIELD} />
          </Field>
          <Field label="Width" htmlFor="width">
            <select id="width" value={compose.sampling.width} onChange={(event) => update((c) => ({ ...c, sampling: { ...c.sampling, width: Number(event.target.value) } }))} className={FIELD}>
              {sizeOptions(compose.sampling.width)}
            </select>
          </Field>
          <Field label="Height" htmlFor="height">
            <select id="height" value={compose.sampling.height} onChange={(event) => update((c) => ({ ...c, sampling: { ...c.sampling, height: Number(event.target.value) } }))} className={FIELD}>
              {sizeOptions(compose.sampling.height)}
            </select>
          </Field>
        </div>
        <Field label="Seed" htmlFor="seed" hint={compose.seedLocked ? "Held: the same seed is sent each time." : "Random: darkroom picks one and the record keeps it."}>
          <div className="flex items-center gap-2">
            <input
              id="seed"
              type="number"
              min={0}
              step={1}
              value={compose.seedLocked ? (compose.seed ?? "") : ""}
              placeholder="random"
              disabled={!compose.seedLocked}
              onChange={(event) => update({ seed: event.target.value === "" ? null : Math.max(0, Math.floor(Number(event.target.value))) })}
              className={FIELD}
            />
            <Button small aria-pressed={compose.seedLocked} onClick={() => update((c) => ({ ...c, seedLocked: !c.seedLocked, seed: c.seedLocked ? c.seed : (c.seed ?? randomSeed()) }))} title={compose.seedLocked ? "Unlock: let darkroom pick a seed" : "Lock: hold this seed"}>
              {compose.seedLocked ? "Locked" : "Lock"}
            </Button>
          </div>
        </Field>
      </div>

      <div className="space-y-3">
        <SectionTitle>Policies</SectionTitle>
        <PolicyPicker policies={policies} enforcing={compose.enforcingPolicy} advisory={compose.advisoryPolicies} onEnforcing={(name) => update((c) => ({ ...c, enforcingPolicy: name, advisoryPolicies: c.advisoryPolicies.filter((entry) => entry !== name) }))} onAdvisory={(names) => update({ advisoryPolicies: names })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Thinking mode" htmlFor="thinking" hint="fast is a verdict and rule; the others also write why. cascade runs fast, then slow on what fast flags.">
          <select id="thinking" value={compose.thinking} onChange={(event) => update({ thinking: event.target.value as ThinkingMode })} className={FIELD}>
            {THINKING_MODES.map((mode) => (
              <option key={mode}>{mode}</option>
            ))}
          </select>
        </Field>
        <Field label="NudeNet blur threshold" htmlFor="threshold" hint="Under an NSFW policy, an exposed score at or above this blurs the image until revealed. It changes the request, not a verdict.">
          <DraftNumber id="threshold" min={NSFW_THRESHOLD_MIN} max={NSFW_THRESHOLD_MAX} step={0.05} value={compose.nsfwThreshold} onValue={(nsfwThreshold) => update({ nsfwThreshold })} className={FIELD} />
        </Field>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border/40 bg-surface py-4">
        <Button
          onClick={() => void check()}
          disabled={!ready || checking || running || readOnly || !compose.userPrompt.trim()}
          title={readOnly ? READ_ONLY_BLOCK : !compose.userPrompt.trim() ? "Write a prompt first." : "POST /preflight: the text-only check, before anything is generated"}
        >
          {checking ? <Spinner /> : null}
          Check
        </Button>
        {running ? (
          <Button tone="danger" onClick={stop} title="Close the stream. Darkroom finishes on its own and keeps the record.">
            Stop
          </Button>
        ) : (
          <Button tone="primary" onClick={start} disabled={!ready || block != null} title={block ?? "POST /generate/stream: pre-flight, then render, then the scans"}>
            Generate
          </Button>
        )}
        {block && ready && !running ? <p className="basis-full text-xs text-muted">{block}</p> : null}
      </div>
    </div>
  );
}

function sizeOptions(current: number) {
  const values = SIZES.includes(current as (typeof SIZES)[number]) ? [...SIZES] : [current, ...SIZES].sort((a, b) => a - b);
  return values.map((value) => (
    <option key={value} value={value}>
      {value}
    </option>
  ));
}
