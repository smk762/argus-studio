"use client";

import { useState } from "react";

import { getRecords, imageUrl } from "@/lib/darkroomApi";
import { OUTCOME_LABEL, OUTCOME_TONE, hasImage } from "@/lib/darkroom/outcome";
import { allCells, overallState, promptChangedVerdict, ruleLetters } from "@/lib/darkroom/shields";
import { ago, formatWhen } from "@/lib/darkroom/time";
import { OUTCOMES, type GenerationRecord, type Mode, type Outcome } from "@/lib/darkroomApi";
import { useLoad } from "@/lib/darkroom/useLoad";

import { useCompose } from "./ComposeProvider";
import { Shield } from "./Shield";
import { Badge, Notice, Spinner } from "./ui";

const PAGE_SIZE = 200;

interface HistoryFilter {
  outcome: Outcome | null;
  mode: Mode | null;
  /** Only records where the isolated and with-prompt scans disagree. */
  changed: boolean;
}

/** `GET /records`, filtered by outcome and mode on darkroom's side and by "Prompt changed the verdict" here. */
export function History() {
  const [filter, setFilterState] = useState<HistoryFilter>({ outcome: null, mode: null, changed: false });
  const { data, error } = useLoad(`${filter.outcome ?? ""}|${filter.mode ?? ""}`, () => getRecords({ outcome: filter.outcome, mode: filter.mode, pageSize: PAGE_SIZE }));
  const fetched = data?.records ?? null;
  const records = fetched && filter.changed ? fetched.filter(promptChangedVerdict) : fetched;

  const setFilter = (patch: Partial<HistoryFilter>) => {
    setFilterState((current) => ({ ...current, ...patch }));
  };

  return (
    <section className="space-y-4" aria-labelledby="history-title">
      <header className="flex flex-wrap items-center gap-3">
        <h1 id="history-title" className="text-2xl font-semibold text-foreground">
          History
        </h1>
        <span className="text-sm text-foreground/70" aria-live="polite">
          {records && fetched ? (filter.changed && fetched.length > 0 ? `${records.length} of ${fetched.length} record${fetched.length === 1 ? "" : "s"}` : `${records.length} record${records.length === 1 ? "" : "s"}`) : ""}
        </span>
      </header>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2" role="group" aria-label="Filters">
        <FilterSelect label="Outcome" value={filter.outcome ?? ""} onChange={(value) => setFilter({ outcome: (value || null) as Outcome | null })} options={[["", "All outcomes"], ...OUTCOMES.map((value): [string, string] => [value, OUTCOME_LABEL[value]])]} />
        <FilterSelect
          label="Mode"
          value={filter.mode ?? ""}
          onChange={(value) => setFilter({ mode: (value || null) as Mode | null })}
          options={[
            ["", "Both modes"],
            ["sfw", "SFW"],
            ["nsfw", "NSFW"],
          ]}
        />
        <label className="flex items-center gap-1.5 text-sm text-foreground" title="Only records where a policy's isolated and with-prompt scans disagree.">
          <input type="checkbox" checked={filter.changed} onChange={(event) => setFilter({ changed: event.target.checked })} className="accent-accent-purple" />
          <span>Prompt changed the verdict</span>
          <span aria-hidden="true" className="rounded-sm border border-accent-amber/60 px-1 text-xs font-bold text-accent-amber">
            ≠
          </span>
        </label>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!records && !error ? (
        <p className="flex items-center gap-2 text-sm text-foreground/70">
          <Spinner /> Loading records…
        </p>
      ) : null}
      {records && records.length === 0 ? (
        <p className="text-sm text-foreground/70">{fetched && fetched.length > 0 && filter.changed ? "No record here where the prompt changed the verdict." : "No records match."}</p>
      ) : null}
      {records && records.length > 0 ? (
        <ul className="space-y-2">
          {records.map((record) => (
            <HistoryRow key={record.id} record={record} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-foreground/70">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-border/60 bg-surface px-2 py-1 text-sm text-foreground">
        {options.map(([optionValue, text]) => (
          <option key={optionValue} value={optionValue}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function HistoryRow({ record }: { record: GenerationRecord }) {
  const { openRecord } = useCompose();
  const worst = overallState(record.guard);
  const letters = worst ? ruleLetters(allCells(record.guard).find((cell) => cell.state === worst)?.result) : [];
  const changed = promptChangedVerdict(record);
  return (
    <li>
      <button type="button" onClick={() => openRecord(record.id)} className="w-full cursor-pointer text-left flex items-center gap-3 rounded-lg border border-border/60 bg-surface p-2 transition-colors hover:border-accent-purple/60 hover:bg-surface-hover/60">
        <Thumb record={record} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{record.request.user_prompt || <span className="text-muted">(empty prompt)</span>}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <Badge className={OUTCOME_TONE[record.outcome]}>{record.outcome}</Badge>
            <span className="uppercase">{record.request.mode}</span>
            <span className="font-mono">{record.guard.enforcing_policy}</span>
            {record.outcome_reason ? <span>· {record.outcome_reason}</span> : null}
            <span title={formatWhen(record.created_at)}>· {ago(record.created_at)}</span>
          </p>
        </div>
        {changed ? (
          <span title="The prompt changed the verdict: the isolated and with-prompt scans disagree" className="rounded-sm border border-accent-amber/60 px-1 text-xs font-bold text-accent-amber">
            ≠
          </span>
        ) : null}
        {worst ? <Shield state={worst} letters={letters} size="h-7 w-7" title={`Overall: ${worst}`} /> : <span className="w-7" />}
      </button>
    </li>
  );
}

/** A thumbnail for a served image. Anything else gets a plain mark and no img element. */
function Thumb({ record }: { record: GenerationRecord }) {
  if (hasImage(record)) {
    const blur = record.guard.nudenet?.blur ?? false;
    return (
      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-hover">
        {/* eslint-disable-next-line @next/next/no-img-element -- loaded by record id from darkroom */}
        <img src={imageUrl(record.id)} alt="" className={`h-full w-full object-cover ${blur ? "blur-md" : ""}`} draggable={false} />
      </span>
    );
  }
  const mark = record.outcome === "deleted" ? "✕" : record.outcome === "omitted" ? "–" : record.outcome === "refused" ? "⊘" : record.outcome === "failed" ? "!" : "·";
  return (
    <span aria-hidden="true" className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md border text-subheading ${record.outcome === "deleted" || record.outcome === "refused" ? "border-accent-red/40 text-accent-red" : "border-dashed border-border text-muted"}`}>
      {mark}
    </span>
  );
}
